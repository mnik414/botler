import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE /api/channels/[id]?tenantId= — disconnect a channel
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const conn = await db.channelConnection.findFirst({ where: { id, tenantId } });
  if (!conn) return NextResponse.json({ error: "not found" }, { status: 404 });

  // For Telegram and Bale, delete the webhook on the Bot API
  let webhookDeleted = true;
  if (conn.platform === "telegram" || conn.platform === "bale") {
    try {
      const creds = JSON.parse(conn.credentialsJson);
      if (creds.botToken) {
        const baseUrl = conn.platform === "telegram"
          ? `https://api.telegram.org/bot${creds.botToken}/deleteWebhook`
          : `https://tapi.bale.ai/bot${creds.botToken}/deleteWebhook`;

        const res = await fetch(baseUrl, { method: "POST" });
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
    data: { status: "disconnected", credentialsJson: "{}", webhookUrl: "" },
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
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const conn = await db.channelConnection.findFirst({ where: { id, tenantId } });
  if (!conn) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  if (typeof body.autoReply === "boolean") data.autoReply = body.autoReply;
  if (typeof body.handoffEnabled === "boolean") data.handoffEnabled = body.handoffEnabled;

  const updated = await db.channelConnection.update({ where: { id }, data });
  return NextResponse.json(updated);
}
