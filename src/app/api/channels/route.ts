import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listChannels } from "@/lib/channel-adapters";

// GET /api/channels?tenantId= — list all channel connections for a tenant
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const connections = await db.channelConnection.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  // Merge with available channel types (so UI shows all platforms even if not connected)
  const allChannels = listChannels().map((adapter) => {
    const conn = connections.find((c) => c.platform === adapter.code);
    return {
      platform: adapter.code,
      name: adapter.name,
      icon: adapter.icon,
      color: adapter.color,
      description: adapter.description,
      setupSteps: adapter.setupSteps,
      credentialsFields: adapter.credentialsFields,
      connected: !!conn,
      connection: conn ? {
        id: conn.id,
        status: conn.status,
        handle: conn.handle,
        webhookUrl: conn.webhookUrl,
        autoReply: conn.autoReply,
        handoffEnabled: conn.handoffEnabled,
        lastMessageAt: conn.lastMessageAt,
        lastTestedAt: conn.lastTestedAt,
        lastTestOk: conn.lastTestOk,
        errorMessage: conn.errorMessage,
        messageCount: conn.messageCount,
      } : null,
    };
  });

  return NextResponse.json(allChannels);
}

// POST /api/channels — connect or update a channel
export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, platform, credentials, handle, autoReply, handoffEnabled } = body;
  if (!tenantId || !platform) return NextResponse.json({ error: "tenantId and platform required" }, { status: 400 });

  const { getChannelAdapter } = await import("@/lib/channel-adapters");
  const adapter = getChannelAdapter(platform);
  if (!adapter) return NextResponse.json({ error: "platform not supported" }, { status: 400 });

  // Generate webhook URL + secret
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-platform.com";
  const webhookSecret = `${platform}-${tenantId.slice(0, 8)}-${Math.random().toString(36).slice(2, 12)}`;
  const webhookUrl = `${origin}/api/channels/webhook/${platform}?tenantId=${tenantId}`;

  // For Telegram, set the webhook on Bot API
  if (platform === "telegram" && credentials?.botToken) {
    try {
      const tgAdapter = adapter as any;
      await tgAdapter.setWebhook(credentials.botToken, webhookUrl, webhookSecret);
    } catch {}
  }

  // Upsert the connection
  const existing = await db.channelConnection.findFirst({ where: { tenantId, platform } });
  let connection;
  if (existing) {
    connection = await db.channelConnection.update({
      where: { id: existing.id },
      data: {
        status: "connected",
        handle: handle || existing.handle,
        credentialsJson: JSON.stringify(credentials || {}),
        webhookUrl,
        webhookSecret,
        autoReply: autoReply ?? true,
        handoffEnabled: handoffEnabled ?? true,
        lastTestedAt: new Date(),
        lastTestOk: true,
        errorMessage: "",
      },
    });
  } else {
    connection = await db.channelConnection.create({
      data: {
        tenantId,
        platform,
        status: "connected",
        handle: handle || "",
        credentialsJson: JSON.stringify(credentials || {}),
        webhookUrl,
        webhookSecret,
        autoReply: autoReply ?? true,
        handoffEnabled: handoffEnabled ?? true,
        lastTestedAt: new Date(),
        lastTestOk: true,
      },
    });
  }

  return NextResponse.json({ id: connection.id, status: "connected", webhookUrl });
}
