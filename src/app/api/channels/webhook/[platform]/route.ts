import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getChannelAdapter } from "@/lib/channel-adapters";
import { runReceptionist } from "@/lib/ai-engine";

// Webhook receiver for all platforms: /api/channels/webhook/[platform]?tenantId=...
// This endpoint receives incoming messages from Instagram, WhatsApp, Telegram, etc.
// and processes them through the AI receptionist, then sends the reply back.

export async function POST(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const adapter = getChannelAdapter(platform);
  if (!adapter) return NextResponse.json({ error: "platform not supported" }, { status: 400 });

  // Find the channel connection
  const conn = await db.channelConnection.findFirst({ where: { tenantId, platform, status: "connected" } });
  if (!conn) return NextResponse.json({ error: "channel not connected" }, { status: 404 });

  // Parse the incoming message
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Verify webhook (security)
  const headers = Object.fromEntries(req.headers.entries());
  if (!adapter.verifyWebhook(headers, body, conn.webhookSecret)) {
    return NextResponse.json({ error: "webhook verification failed" }, { status: 403 });
  }

  // Parse the message into standard format
  const parsed = adapter.parseIncomingMessage(body);
  if (!parsed) {
    // Might be a webhook verification challenge (Meta) or non-message event
    // Meta webhook verification: respond with the challenge
    if (body?.hub?.mode === "subscribe" && body?.hub?.verify_token) {
      const creds = JSON.parse(conn.credentialsJson || "{}");
      if (body.hub.verify_token === creds.verifyToken) {
        return NextResponse.json(parseInt(body.hub.challenge) || body.hub.challenge);
      }
      return NextResponse.json({ error: "verification failed" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, message: "no text message" });
  }

  // Only process if autoReply is enabled
  if (!conn.autoReply) {
    return NextResponse.json({ ok: true, message: "auto-reply disabled" });
  }

  try {
    // Get tenant + agent
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { agent: true } });
    if (!tenant?.agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });

    // Find or create a conversation for this sender
    let conversation = await db.conversation.findFirst({
      where: { tenantId, endUserPhone: parsed.senderId, channel: platform },
      orderBy: { updatedAt: "desc" },
    });
    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          tenantId,
          channel: platform,
          status: "ai",
          endUserName: parsed.senderName,
          endUserPhone: parsed.senderId,
        },
      });
    }

    // Save the incoming user message
    await db.message.create({
      data: { conversationId: conversation.id, role: "user", content: parsed.text },
    });

    // Run the AI receptionist
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
      history: [],
      userMessage: parsed.text,
    });

    // Save the AI reply
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

    // Update conversation
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        confidence: result.confidence,
        messageCount: { increment: 2 },
        updatedAt: new Date(),
        status: result.handoff ? "handoff" : "ai",
      },
    });

    // Update channel message count
    await db.channelConnection.update({
      where: { id: conn.id },
      data: { messageCount: { increment: 1 }, lastMessageAt: new Date() },
    });

    // Send the reply back to the user on the platform
    const creds = JSON.parse(conn.credentialsJson || "{}");
    await (adapter as any).sendMessage(creds, parsed.senderId, result.reply);

    return NextResponse.json({ ok: true, replied: true });
  } catch (e: any) {
    console.error("webhook processing error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
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
      const creds = JSON.parse(conn.credentialsJson || "{}");
      if (token === creds.verifyToken) {
        return new NextResponse(challenge || "", { status: 200 });
      }
    }
  }

  // Telegram webhook verification is different (just respond 200)
  return new NextResponse("OK", { status: 200 });
}
