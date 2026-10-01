import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listChannels } from "@/lib/channel-adapters";
import { isResponse, requireTenant, requireTenantOwner } from "@/lib/auth";
import { randomBytes } from "crypto";
import { encryptSecret } from "@/lib/crypto";

// GET /api/channels?tenantId= — list all channel connections for a tenant
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await requireTenant(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const connections = await db.channelConnection.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "asc" },
  });

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
      connection: conn
        ? {
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
          }
        : null,
    };
  });

  return NextResponse.json(allChannels);
}

function resolveBaseUrl(req: Request): string | null {
  const configured = process.env.NEXT_PUBLIC_BASE_URL || "";
  if (configured) {
    return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  }
  const host = req.headers.get("host");
  if (!host) return null;
  const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

// POST /api/channels — connect or update a channel
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const auth = await requireTenantOwner(req, body.tenantId);
  if (isResponse(auth)) return auth;

  const { platform, credentials, handle, autoReply, handoffEnabled } = body;
  if (typeof platform !== "string" || !platform) {
    return NextResponse.json({ error: "platform required" }, { status: 400 });
  }

  const { getChannelAdapter } = await import("@/lib/channel-adapters");
  const adapter = getChannelAdapter(platform);
  if (!adapter) return NextResponse.json({ error: "platform not supported" }, { status: 400 });

  const origin = resolveBaseUrl(req);
  if (!origin) return NextResponse.json({ error: "NEXT_PUBLIC_BASE_URL تنظیم نشده است" }, { status: 500 });

  const webhookSecret = `${platform}-${randomBytes(24).toString("hex")}`;
  const webhookUrl = `${origin}/api/channels/webhook/${platform}?tenantId=${auth.tenantId}`;

  const creds = credentials && typeof credentials === "object" ? credentials : {};
  const credsJson = encryptSecret(JSON.stringify(creds));

  // For Telegram and Bale, set the webhook on the Bot API automatically
  if ((platform === "telegram" || platform === "bale") && (creds as any).botToken) {
    try {
      const botAdapter = adapter as any;
      await botAdapter.setWebhook((creds as any).botToken, webhookUrl, webhookSecret);
    } catch (e) {
      console.error("[channels] setWebhook failed", e);
    }
  }

  const existing = await db.channelConnection.findFirst({ where: { tenantId: auth.tenantId, platform } });
  let connectionId: string;
  if (existing) {
    const connection = await db.channelConnection.update({
      where: { id: existing.id },
      data: {
        status: "connected",
        handle: typeof handle === "string" ? handle.slice(0, 200) : existing.handle,
        credentialsJson: credsJson,
        webhookUrl,
        webhookSecret,
        autoReply: autoReply !== false,
        handoffEnabled: handoffEnabled !== false,
        lastTestedAt: new Date(),
        lastTestOk: true,
        errorMessage: "",
      },
      select: { id: true },
    });
    connectionId = connection.id;
  } else {
    const connection = await db.channelConnection.create({
      data: {
        tenantId: auth.tenantId,
        platform,
        status: "connected",
        handle: typeof handle === "string" ? handle.slice(0, 200) : "",
        credentialsJson: credsJson,
        webhookUrl,
        webhookSecret,
        autoReply: autoReply !== false,
        handoffEnabled: handoffEnabled !== false,
        lastTestedAt: new Date(),
        lastTestOk: true,
      },
      select: { id: true },
    });
    connectionId = connection.id;
  }

  return NextResponse.json({ id: connectionId, status: "connected", webhookUrl });
}
