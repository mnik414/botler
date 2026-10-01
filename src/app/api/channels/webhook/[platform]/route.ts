import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChannelAdapter } from "@/lib/channel-adapters";
import { runReceptionist, detectBooking, normalizePhone } from "@/lib/ai-engine";
import { checkQuota, reserveMessages, recordUsage } from "@/lib/quota";
import { createHash, randomBytes } from "crypto";
import { decryptSecret } from "@/lib/crypto";
import { safeEqual } from "@/lib/safe-equal";

// Webhook receiver for all platforms: /api/channels/webhook/[platform]?tenantId=...
// Authenticated by the platform-specific signature (see channel-adapters.verifyWebhook).

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const adapter = getChannelAdapter(platform);
  if (!adapter) return NextResponse.json({ error: "platform not supported" }, { status: 400 });

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const conn = await db.channelConnection.findFirst({ where: { tenantId, platform, status: "connected" } });
  if (!conn) return NextResponse.json({ error: "channel not connected" }, { status: 404 });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
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

  const parsedMessages = adapter.parseIncomingMessages(body);
  if (!parsedMessages.length) {
    // Meta webhook verification challenge (rare on POST)
    if (body?.hub?.mode === "subscribe" && body?.hub?.verify_token) {
      if (typeof credentials.verifyToken === "string" && safeEqual(String(body.hub.verify_token), credentials.verifyToken)) {
        return NextResponse.json(parseInt(body.hub.challenge) || body.hub.challenge);
      }
      return NextResponse.json({ error: "verification failed" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, message: "no text message" });
  }

  if (!conn.autoReply) {
    return NextResponse.json({ ok: true, message: "auto-reply disabled" });
  }

  // Load tenant once for the whole batch
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { agent: true } });
  if (!tenant?.agent) return NextResponse.json({ ok: true, message: "agent not found" });
  if (tenant.status === "suspended") return NextResponse.json({ ok: true, message: "tenant suspended" });

  for (const parsed of parsedMessages) {
    const outcome = await processMessage({ platform, tenantId, conn, adapter, credentials, parsed, tenant });
    if (outcome.status !== 200) return NextResponse.json(outcome.body, { status: outcome.status });
  }

  return NextResponse.json({ ok: true, replied: true });
}

interface ProcessArgs {
  platform: string;
  tenantId: string;
  conn: any;
  adapter: NonNullable<ReturnType<typeof getChannelAdapter>>;
  credentials: any;
  parsed: { senderId: string; senderName: string; text: string; eventKey: string };
  tenant: any;
}

// Processes one inbound message with tenant-scoped idempotency:
// - platform retries after a successful LLM call resend the stored reply
//   without re-running (and re-billing) the model
// - any processing failure removes the marker so the retry can re-attempt
async function processMessage({
  platform,
  tenantId,
  conn,
  adapter,
  credentials,
  parsed,
  tenant,
}: ProcessArgs): Promise<{ status: number; body: any }> {
  if (!parsed.senderId) return { status: 200, body: { ok: true, message: "missing sender id" } };

  const eventKey = (parsed.eventKey || createHash("sha256").update(`${parsed.senderId}:${parsed.text}`).digest("hex")).slice(0, 128);

  const existing = await db.processedEvent.findUnique({
    where: { tenantId_platform_eventKey: { tenantId, platform, eventKey } },
  });
  if (existing) {
    if (existing.replyText) {
      // The LLM already ran; only delivery is missing. Resend, do not recharge.
      const sendResult = await adapter.sendMessage(credentials, String(parsed.senderId), existing.replyText);
      if (!sendResult.ok) {
        await db.channelConnection
          .update({ where: { id: conn.id }, data: { errorMessage: (sendResult.error || "send failed").slice(0, 500) } })
          .catch(() => {});
        return { status: 502, body: { error: "failed to send reply" } };
      }
      await db.processedEvent.update({ where: { id: existing.id }, data: { status: "done" } }).catch(() => {});
      return { status: 200, body: { ok: true, replied: true, resent: true } };
    }
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  const quota = await checkQuota(tenantId);
  if (!quota.ok) {
    console.warn(`[webhook] quota/status blocked for tenant ${tenantId}: ${quota.reason}`);
    return { status: 200, body: { ok: true, message: "quota exceeded" } };
  }

  try {
    await db.processedEvent.create({ data: { platform, eventKey, tenantId, status: "pending" } });
  } catch (e: any) {
    if (e?.code === "P2002") return { status: 200, body: { ok: true, duplicate: true } };
    throw e;
  }

  try {
    const reserved = await reserveMessages(tenantId, 1);
    if (!reserved.ok) {
      await db.processedEvent.delete({ where: { tenantId_platform_eventKey: { tenantId, platform, eventKey } } }).catch(() => {});
      return { status: 200, body: { ok: true, message: "quota exceeded" } };
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
        model: tenant.agent.model,
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
        sourcesJson: JSON.stringify(result.sources.map((s) => s.id)),
        handoff: result.handoff,
      },
    });

    // Lead capture — canonical phone (E.164) deduped per tenant
    const leadPhone = normalizePhone(result.lead.phone || String(parsed.senderId) || "");
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
        update: {},
      });
      await db.conversation.update({
        where: { id: conversation.id },
        data: { leadCaptured: true, endUserPhone: leadPhone },
      });
    }

    // Booking intent (same dedupe key as the widget path)
    const booking = detectBooking(String(parsed.text));
    if (booking.detected && booking.type) {
      try {
        await db.booking.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            type: booking.type,
            dedupeKey: `${conversation.id}:${booking.type}`,
            payloadJson: JSON.stringify({
              details: booking.details,
              label: booking.type,
              endUserName: parsed.senderName || "کاربر",
              endUserPhone: leadPhone,
              capturedAt: new Date().toISOString(),
            }),
            status: "pending",
          },
        });
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
        const dedupeKey = `${conversation.id}:${booking.type}`;
        const existing = await db.booking.findUnique({ where: { dedupeKey }, select: { id: true, status: true } });
        if (existing?.status === "cancelled") {
          await db.booking.update({
            where: { id: existing.id },
            data: {
              status: "pending",
              payloadJson: JSON.stringify({
                details: booking.details,
                label: booking.type,
                endUserName: parsed.senderName || "کاربر",
                endUserPhone: leadPhone,
                capturedAt: new Date().toISOString(),
              }),
            },
          });
        }
      }
    }

    // Growth-loop internal lead (unique per tenant+conversation)
    if (result.growth.isBusinessOwner) {
      try {
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
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
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

    await recordUsage(tenantId, { tokens: result.tokens, feature: `channel:${platform}`, model: tenant.agent.model });

    // Persist the reply BEFORE sending so a delivery failure can be retried
    // without re-running the model.
    await db.processedEvent.update({
      where: { tenantId_platform_eventKey: { tenantId, platform, eventKey } },
      data: { replyText: result.reply },
    });

    const sendResult = await adapter.sendMessage(credentials, String(parsed.senderId), result.reply);
    if (!sendResult.ok) {
      // Keep the stored reply; the platform retry will only resend it.
      await db.channelConnection
        .update({ where: { id: conn.id }, data: { errorMessage: (sendResult.error || "send failed").slice(0, 500) } })
        .catch(() => {});
      return { status: 502, body: { error: "failed to send reply" } };
    }

    await db.processedEvent.update({
      where: { tenantId_platform_eventKey: { tenantId, platform, eventKey } },
      data: { status: "done" },
    });
    return { status: 200, body: { ok: true, replied: true } };
  } catch (e: any) {
    console.error("[webhook] processing error", e);
    // Remove the marker when no reply was generated so the retry reprocesses.
    await db.processedEvent
      .deleteMany({ where: { tenantId, platform, eventKey, replyText: "" } })
      .catch(() => {});
    return { status: 500, body: { error: "خطای سرور در پردازش پیام" } };
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
    const conn = await db.channelConnection.findFirst({ where: { tenantId, platform, status: "connected" } });
    if (conn) {
      let creds: any = {};
      try {
        creds = JSON.parse(decryptSecret(conn.credentialsJson) || "{}");
      } catch {
        creds = {};
      }
      if (typeof creds.verifyToken === "string" && safeEqual(token, creds.verifyToken)) {
        return new NextResponse(challenge || "", { status: 200 });
      }
    }
    return new NextResponse("forbidden", { status: 403 });
  }

  // Telegram/Bale webhook checks expect a plain 200
  return new NextResponse("OK", { status: 200 });
}
