import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenant } from "@/lib/auth";

const ALLOWED_TYPES = ["order", "reservation", "appointment", "callback"];

function parsePayload(json: string): any {
  try {
    return JSON.parse(json || "{}");
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await requireTenant(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const bookings = await db.booking.findMany({
    where: { tenantId: auth.tenantId },
    include: { lead: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(bookings.map((b) => ({ ...b, payload: parsePayload(b.payloadJson) })));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const auth = await requireTenant(req, body.tenantId);
  if (isResponse(auth)) return auth;

  const { type, payload, leadId, scheduledAt } = body;
  if (typeof type !== "string" || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json({ error: "نوع رزرو نامعتبر است" }, { status: 400 });
  }

  if (leadId) {
    const lead = await db.lead.findFirst({ where: { id: String(leadId), tenantId: auth.tenantId }, select: { id: true } });
    if (!lead) return NextResponse.json({ error: "لید یافت نشد" }, { status: 404 });
  }

  const booking = await db.booking.create({
    data: {
      tenantId: auth.tenantId,
      type,
      leadId: leadId ? String(leadId) : null,
      payloadJson: JSON.stringify(payload && typeof payload === "object" ? payload : {}),
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: "pending",
    },
  });
  return NextResponse.json(booking, { status: 201 });
}
