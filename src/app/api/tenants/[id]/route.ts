import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      plan: true,
      subscription: true,
      agent: true,
      referral: true,
      users: true,
      _count: { select: { conversations: true, leads: true, knowledge: true, bookings: true } },
    },
  });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["name", "description", "phone", "address", "instagram", "website", "accentColor", "logoUrl", "status", "category"];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  const tenant = await db.tenant.update({ where: { id }, data });
  return NextResponse.json(tenant);
}
