import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/track?phone=0912...&tenantId=...
// End-user request tracking: finds their conversations, leads, and bookings for a tenant
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone")?.trim();
  const tenantId = searchParams.get("tenantId");
  if (!phone || !tenantId) {
    return NextResponse.json({ error: "phone and tenantId required" }, { status: 400 });
  }

  const [conversations, leads, bookings] = await Promise.all([
    db.conversation.findMany({
      where: { tenantId, endUserPhone: phone },
      select: { id: true, status: true, createdAt: true, updatedAt: true, messageCount: true, channel: true },
      orderBy: { createdAt: "desc" },
    }),
    db.lead.findMany({
      where: { tenantId, phone },
      select: { id: true, name: true, intent: true, status: true, value: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.booking.findMany({
      where: { tenantId, payloadJson: { contains: phone } },
      select: { id: true, type: true, status: true, createdAt: true, scheduledAt: true, payloadJson: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    found: conversations.length > 0 || leads.length > 0 || bookings.length > 0,
    conversations,
    leads,
    bookings: bookings.map((b) => ({ ...b, payload: JSON.parse(b.payloadJson) })),
  });
}
