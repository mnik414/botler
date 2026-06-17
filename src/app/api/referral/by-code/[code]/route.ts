import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Look up a referral by its code (public, for the /ref/[code] landing page)
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referral = await db.referral.findUnique({
    where: { code: code.toUpperCase() },
    include: { tenant: { select: { id: true, name: true, slug: true, businessType: true, accentColor: true, description: true } } },
  });
  if (!referral) return NextResponse.json({ error: "کد معرفی یافت نشد" }, { status: 404 });
  return NextResponse.json({
    code: referral.code,
    clicks: referral.clicks,
    signups: referral.signups,
    credits: referral.credits,
    commission: referral.commission,
    tenant: referral.tenant,
  });
}
