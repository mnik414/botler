import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(
    plans.map((p) => ({ ...p, features: JSON.parse(p.featuresJson) }))
  );
}
