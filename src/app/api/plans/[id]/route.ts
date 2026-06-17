import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/plans/[id] — update a plan (Super Admin: price, limits, features, etc.)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "name", "description", "priceMonthly", "messageLimit", "conversationLimit",
    "voiceMinutes", "tokenLimit", "popular",
  ];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  // features is an array → stored as JSON string
  if (Array.isArray(body.features)) {
    data.featuresJson = JSON.stringify(body.features);
  }

  const plan = await db.plan.update({ where: { id }, data });
  return NextResponse.json({ ...plan, features: JSON.parse(plan.featuresJson) });
}
