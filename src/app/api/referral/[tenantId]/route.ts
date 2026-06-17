import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const referral = await db.referral.findUnique({ where: { tenantId } });
  if (!referral) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(referral);
}

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const body = await req.json().catch(() => ({}));
  // Record a click / signup
  const referral = await db.referral.findUnique({ where: { tenantId } });
  if (!referral) return NextResponse.json({ error: "not found" }, { status: 404 });
  const data: any = {};
  if (body.event === "click") data.clicks = referral.clicks + 1;
  if (body.event === "signup") {
    data.signups = referral.signups + 1;
    data.credits = referral.credits + 100000; // 100k toman free credit
    data.commission = referral.commission + 50000;
  }
  const updated = await db.referral.update({ where: { tenantId }, data });
  return NextResponse.json(updated);
}
