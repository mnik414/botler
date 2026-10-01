import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(
    plans.map((p) => {
      let features: string[] = [];
      try {
        const parsed = JSON.parse(p.featuresJson);
        if (Array.isArray(parsed)) features = parsed;
      } catch {}
      return { ...p, features };
    })
  );
}
