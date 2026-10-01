import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const auth = await requireTenantOwner(req, body.tenantId);
  if (isResponse(auth)) return auth;

  const conn = await db.channelConnection.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!conn) return NextResponse.json({ error: "channel not found" }, { status: 404 });

  let ok = false;
  let reply = "";
  let error = "";

  try {
    const creds = JSON.parse(decryptSecret(conn.credentialsJson) || "{}");

    if (conn.platform === "telegram" || conn.platform === "bale") {
      if (!creds.botToken) {
        error = "توکن ربات ثبت نشده است";
      } else if (conn.platform === "telegram") {
        const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`, {
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();
        if (data.ok) {
          ok = true;
          reply = `ربات @${data.result.username} فعال است`;
        } else {
          error = data.description || "Failed to verify bot token";
        }
      } else {
        try {
          const res = await fetch(`https://tapi.bale.ai/bot${creds.botToken}/getWebhookInfo`, {
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json();
          if (data.ok) {
            ok = true;
            reply = "ربات بله فعال است";
          } else {
            error = data.description || "Failed to verify bot token";
          }
        } catch (e: any) {
          ok = false;
          error = e?.message || "ارتباط با API بله برقرار نشد";
        }
      }
    } else if (conn.platform === "instagram" || conn.platform === "whatsapp") {
      const platform = conn.platform === "instagram" ? "Instagram" : "WhatsApp";
      if (creds.accessToken) {
        const res = await fetch(
          `https://graph.facebook.com/v18.0/me?access_token=${encodeURIComponent(creds.accessToken)}`,
          { signal: AbortSignal.timeout(8000) }
        );
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
      error = "این کانال از تست خودکار پشتیبانی نمی‌کند";
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
