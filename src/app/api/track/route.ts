import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/ai-engine";

// Phone + per-conversation track token are required so phone numbers cannot be
// enumerated. The token is shown to the end user by the chat widget.

function safePayload(json: string): any {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const limit = rateLimit(`track:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const phoneRaw = searchParams.get("phone")?.trim();
  const token = searchParams.get("token")?.trim();
  if (!phoneRaw || !token) {
    return NextResponse.json({ error: "phone و کد پیگیری الزامی است" }, { status: 400 });
  }
  if (token.length < 16 || token.length > 128) {
    return NextResponse.json({ error: "کد پیگیری نامعتبر است" }, { status: 400 });
  }

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return NextResponse.json({ found: false, conversations: [], leads: [], bookings: [] });
  }
  // Match canonical E.164 plus legacy stored formats (09…, 9…, +98…).
  const local = phone.slice(3);
  const conversation = await db.conversation.findFirst({
    where: {
      trackToken: token,
      endUserPhone: { in: [phone, local, `0${local}`] },
    },
    select: { id: true, tenantId: true, status: true, channel: true, createdAt: true, updatedAt: true, messageCount: true },
  });
  if (!conversation) {
    return NextResponse.json({ found: false, conversations: [], leads: [], bookings: [] });
  }

  const [leads, bookings] = await Promise.all([
    db.lead.findMany({
      where: { tenantId: conversation.tenantId, conversationId: conversation.id },
      select: { id: true, name: true, intent: true, status: true, value: true, createdAt: true },
    }),
    db.booking.findMany({
      where: { tenantId: conversation.tenantId, conversationId: conversation.id },
      select: { id: true, type: true, status: true, createdAt: true, scheduledAt: true, payloadJson: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    found: true,
    conversations: [
      {
        id: conversation.id,
        status: conversation.status,
        channel: conversation.channel,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messageCount,
      },
    ],
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      intent: l.intent,
      status: l.status,
      value: l.value,
      createdAt: l.createdAt,
    })),
    bookings: bookings.map((b) => ({
      id: b.id,
      type: b.type,
      status: b.status,
      createdAt: b.createdAt,
      scheduledAt: b.scheduledAt,
      payload: safePayload(b.payloadJson),
    })),
  });
}
