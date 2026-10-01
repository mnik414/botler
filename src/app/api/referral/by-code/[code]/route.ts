import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { REFERRAL_WELCOME_CREDITS } from "@/lib/referral";

// Look up a referral by its code (public landing page).
// Side-effect free: click tracking happens through the dedicated POST
// /api/referral/by-code/[code]/click endpoint so crawlers/previews do not
// inflate clicks and GET stays cacheable/idempotent.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const limit = rateLimit(`ref-code:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const { code } = await params;
  if (code.length > 32) return NextResponse.json({ error: "کد معرفی یافت نشد" }, { status: 404 });

  const referral = await db.referral.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, businessType: true, accentColor: true, description: true },
      },
    },
  });
  if (!referral) return NextResponse.json({ error: "کد معرفی یافت نشد" }, { status: 404 });

  return NextResponse.json({
    code: referral.code,
    rewardCredits: REFERRAL_WELCOME_CREDITS,
    commissionPercent: 10,
    tenant: referral.tenant,
  });
}
