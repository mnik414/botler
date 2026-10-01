import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";

// DELETE /api/channels/[id]?tenantId= — disconnect a channel
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const auth = await requireTenantOwner(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const conn = await db.channelConnection.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!conn) return NextResponse.json({ error: "not found" }, { status: 404 });

  let webhookDeleted = true;
  if (conn.platform === "telegram" || conn.platform === "bale") {
    try {
      const creds = JSON.parse(decryptSecret(conn.credentialsJson) || "{}");
      if (creds.botToken) {
        const baseUrl =
          conn.platform === "telegram"
            ? `https://api.telegram.org/bot${creds.botToken}/deleteWebhook`
            : `https://tapi.bale.ai/bot${creds.botToken}/deleteWebhook`;

        const res = await fetch(baseUrl, { method: "POST", signal: AbortSignal.timeout(8000) });
        const result = await res.json();
        webhookDeleted = result.ok === true;
        if (!webhookDeleted) {
          console.error(`[Channel Disconnect] Failed to delete ${conn.platform} webhook:`, result.description || result);
        }
      }
    } catch (e: any) {
      console.error(`[Channel Disconnect] Error deleting ${conn.platform} webhook:`, e.message);
      webhookDeleted = false;
    }
  }

  await db.channelConnection.update({
    where: { id },
    data: { status: "disconnected", credentialsJson: "{}", webhookUrl: "", webhookSecret: "" },
  });

  return NextResponse.json({
    ok: true,
    status: "disconnected",
    webhookDeleted,
    message: webhookDeleted
      ? "کانال قطع شد"
      : `کانال قطع شد اما وب‌هوک ${conn.platform} حذف نشد. ممکن است نیاز به حذف دستی از BotFather داشته باشید.`,
  });
}

// PATCH /api/channels/[id]?tenantId= — update settings (autoReply, handoff)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const auth = await requireTenantOwner(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const conn = await db.channelConnection.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true } });
  if (!conn) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.autoReply === "boolean") data.autoReply = body.autoReply;
  if (typeof body.handoffEnabled === "boolean") data.handoffEnabled = body.handoffEnabled;

  const updated = await db.channelConnection.update({
    where: { id },
    data,
    select: {
      id: true,
      tenantId: true,
      platform: true,
      status: true,
      handle: true,
      webhookUrl: true,
      autoReply: true,
      handoffEnabled: true,
      lastMessageAt: true,
      lastTestedAt: true,
      lastTestOk: true,
      errorMessage: true,
      messageCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(updated);
}
