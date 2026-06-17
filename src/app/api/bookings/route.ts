import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  const bookings = await db.booking.findMany({ where: { tenantId }, include: { lead: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(bookings.map((b) => ({ ...b, payload: JSON.parse(b.payloadJson) })));
}

export async function POST(req: Request) {
  const { tenantId, type, payload, leadId, scheduledAt } = await req.json();
  const booking = await db.booking.create({
    data: {
      tenantId,
      type,
      leadId: leadId || null,
      payloadJson: JSON.stringify(payload || {}),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: "pending",
    },
  });
  return NextResponse.json(booking, { status: 201 });
}
