import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChannelAdapter } from "@/lib/channel-adapters";
import { runReceptionist } from "@/lib/ai-engine";
import { checkQuota, recordUsage } from "@/lib/quota";
import { createHash, randomBytes } from "crypto";
import { decryptSecret } from "@/lib/crypto";

// Webhook receiver for all platforms: /api/channels/webhook/[platform]?tenantId=...
// Authenticated by the platform-specific signature (see channel-adapters.verifyWebhook).

export async function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const adapter = getChannelAdapter(platform);
  if (!adapter) return NextResponse.json({ error: "platform not supported" }, { status: 400 });

  const conn = await db.channelConnection.findFirst({ where: { tenantId, platform, status: "connected" } });
  if (!conn) return NextResponse.json({ error: "channel not connected" }, { status: 404 });

  const rawBody = await req.text();
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  let credentials: any = {};
  try {
    credentials = JSON.parse(decryptSecret(conn.credentialsJson) || "{}");
  } catch {
    credentials = {};
  }

  // Verify webhook signature (mandatory)
  const headers = Object.fromEntries(req.headers.entries());
  if (!adapter.verifyWebhook(headers, rawBody, { secret: conn.webhookSecret, credentials })) {
    return NextResponse.json({ error: "webhook verification failed" }, { status: 403 });
  }

  const parsed = adapter.parseIncomingMessage(body);
  if (!parsed) {
    // Meta webhook verification challenge (rare on POST)
    if (body?.hub?.mode === "subscribe" && body?.hub?.verify_token) {
      if (body.hub.verify_token === credentials.verifyToken) {
        return NextResponse.json(parseInt(body.hub.challenge) || body.hub.challenge);
      }
      return NextResponse.json({ error: "verification failed" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, message: "no text message" });
  }

  if (!parsed.senderId) {
    return NextResponse.json({ error: "missing sender id" }, { status: 400 });
  }

  if (!conn.autoReply) {
    return NextResponse.json({ ok: true, message: "auto-reply disabled" });
  }

  // Idempotency: platform retries the same event
  const eventKey = (parsed.eventKey || createHash("sha256").update(rawBody).digest("hex")).slice(0, 128);
  try {
    await db.processedEvent.create({ data: { platform, eventKey, tenantId } });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw e;
  }

  try {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { agent: true } });
    if (!tenant?.agent) {
      return NextResponse.json({ ok: true, message: "agent not found" });
    }
    if (tenant.status === "suspended") {
      return NextResponse.json({ ok: true, message: "tenant suspended" });
    }
    const quota = await checkQuota(tenantId);
    if (!quota.ok) {
      return NextResponse.json({ ok: true, message: "quota exceeded" });
    }

    // Atomic conversation resolution per (tenant, platform, sender)
    const senderKey = `${tenantId}:${platform}:${parsed.senderId}`.slice(0, 300);
    const conversation = await db.conversation.upsert({
      where: { senderKey },
      create: {
        tenantId,
        channel: platform,
        status: "ai",
        endUserName: (parsed.senderName || "کاربر").slice(0, 200),
        endUserPhone: String(parsed.senderId).slice(0, 50),
        senderKey,
        trackToken: randomBytes(16).toString("hex"),
      },
      update: {},
    });

    // Conversation history for context
    const recent = await db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { role: true, content: true },
    });
    const history = recent.reverse().map((m) => ({
      role: (m.role === "assistant" || m.role === "operator" ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
      createdAt: new Date().toISOString(),
    }));

    await db.message.create({
      data: { conversationId: conversation.id, role: "user", content: String(parsed.text).slice(0, 5000) },
    });

    const result = await runReceptionist({
      tenantId,
      agent: {
        systemPrompt: tenant.agent.systemPrompt,
        temperature: tenant.agent.temperature,
        confidenceThreshold: tenant.agent.confidenceThreshold,
        humanHandoff: conn.handoffEnabled && tenant.agent.humanHandoff,
        growthLoop: tenant.agent.growthLoop,
        name: tenant.agent.name,
        aiProviderId: tenant.agent.aiProviderId,
      },
      businessName: tenant.name,
      businessType: tenant.businessType,
      history,
      userMessage: String(parsed.text).slice(0, 5000),
    });

    await db.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: result.reply,
        confidence: result.confidence,
        tokens: result.tokens,
        handoff: result.handoff,
      },
    });

    // Lead capture (deduplicated by phone per tenant)
    const leadPhone = result.lead.phone ? result.lead.phone.replace(/[^\d+]/g, "").slice(0, 20) : "";
    if (result.lead.detected && leadPhone) {
      await db.lead.upsert({
        where: { tenantId_phone: { tenantId, phone: leadPhone } },
        create: {
          tenantId,
          conversationId: conversation.id,
          name: (result.lead.name || parsed.senderName || "مهمان").slice(0, 200),
          phone: leadPhone,
          email: (result.lead.email || "").slice(0, 200),
          source: platform === "voice" ? "voice" : "chat",
          intent: "inquiry",
          status: "new",
        },
        update: { conversationId: conversation.id },
      });
      await db.conversation.update({
        where: { id: conversation.id },
        data: { leadCaptured: true, endUserPhone: leadPhone },
      });
    }

    // Growth-loop internal lead
    if (result.growth.isBusinessOwner) {
      const existingInternal = await db.internalLead.findFirst({
        where: { tenantId, conversationId: conversation.id },
        select: { id: true },
      });
      if (!existingInternal) {
        await db.internalLead.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            endUserName: "کاربر نهایی",
            signal: "business_owner_signal",
            score: result.growth.score,
            status: "new",
          },
        });
      }
    }

    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        confidence: result.confidence,
        messageCount: { increment: 2 },
        updatedAt: new Date(),
        status: result.handoff ? "handoff" : "ai",
      },
    });

    await db.channelConnection.update({
      where: { id: conn.id },
      data: { messageCount: { increment: 1 }, lastMessageAt: new Date(), errorMessage: "" },
    });

    await recordUsage(tenantId, { tokens: result.tokens, messages: 1, feature: `channel:${platform}` });

    // Send the reply back to the user on the platform
    const sendResult = await adapter.sendMessage(credentials, String(parsed.senderId), result.reply);
    if (!sendResult.ok) {
      // Allow the platform retry to re-attempt delivery
      await db.processedEvent
        .delete({ where: { platform_eventKey: { platform, eventKey } } })
        .catch(() => {});
      await db.channelConnection
        .update({ where: { id: conn.id }, data: { errorMessage: (sendResult.error || "send failed").slice(0, 500) } })
        .catch(() => {});
      return NextResponse.json({ error: "failed to send reply" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, replied: true });
  } catch (e: any) {
    console.error("[webhook] processing error", e);
    return NextResponse.json({ error: "خطای سرور در پردازش پیام" }, { status: 500 });
  }
}

// GET handler for Meta webhook verification (Instagram/WhatsApp)
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && tenantId) {
    const conn = await db.channelConnection.findFirst({ where: { tenantId, platform } });
    if (conn) {
      let creds: any = {};
      try {
        creds = JSON.parse(decryptSecret(conn.credentialsJson) || "{}");
      } catch {
        creds = {};
      }
      if (creds.verifyToken && token === creds.verifyToken) {
        return new NextResponse(challenge || "", { status: 200 });
      }
    }
    return new NextResponse("OK", { status: 200 });
  }

  // Telegram/Bale webhook checks expect a plain 200
  return new NextResponse("OK", { status: 200 });
}
