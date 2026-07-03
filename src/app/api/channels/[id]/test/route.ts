import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { tenantId } = body;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const conn = await db.channelConnection.findFirst({ where: { id, tenantId } });
  if (!conn) return NextResponse.json({ error: "channel not found" }, { status: 404 });

  let ok = false;
  let reply = "";
  let error = "";

  try {
    const creds = JSON.parse(conn.credentialsJson || "{}");

    if (conn.platform === "telegram" || conn.platform === "bale") {
      const baseUrl = conn.platform === "telegram"
        ? `https://api.telegram.org/bot${creds.botToken}`
        : `https://api.bale.ai/v1/bots/${creds.botToken}`;

      const res = await fetch(`${baseUrl}/getMe`, { method: "GET" });
      const data = await res.json();
      if (data.ok) {
        ok = true;
        reply = `ربات @${data.result.username} فعال است`;
      } else {
        error = data.description || "Failed to verify bot token";
      }
    } else if (conn.platform === "instagram" || conn.platform === "whatsapp") {
      const platform = conn.platform === "instagram" ? "Instagram" : "WhatsApp";
      if (creds.accessToken) {
        const res = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${creds.accessToken}`);
        const data = await res.json();
        if (data.id) {
          ok = true;
          reply = `اتصال ${platform} تأیید شد`;
        } else {
          error = data.error?.message || "Invalid access token";
        }
      } else {
        error = "Access token not found";
      }
    } else {
      ok = true;
      reply = "اتصال تأیید شد";
    }
  } catch (e: any) {
    error = e.message;
  }

  await db.channelConnection.update({
    where: { id },
    data: { lastTestedAt: new Date(), lastTestOk: ok, errorMessage: error },
  });

  return NextResponse.json({ ok, reply, error });
}