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

  // For Telegram, delete the webhook
  if (conn.platform === "telegram") {
    try {
      const creds = JSON.parse(conn.credentialsJson);
      if (creds.botToken) {
        await fetch(`https://api.telegram.org/bot${creds.botToken}/deleteWebhook`);
      }
    } catch {}
  }

  await db.channelConnection.update({ where: { id }, data: { status: "disconnected", credentialsJson: "{}" } });
  return NextResponse.json({ ok: true, status: "disconnected" });
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
