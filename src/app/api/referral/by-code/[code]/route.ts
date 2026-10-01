import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// Look up a referral by its code (public landing page).
// Referrer financial stats are intentionally NOT exposed publicly; the click is
// recorded server-side with an atomic increment.
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

  await db.referral.update({
    where: { id: referral.id },
    data: { clicks: { increment: 1 } },
  });

  return NextResponse.json({
    code: referral.code,
    rewardCredits: 100_000,
    tenant: referral.tenant,
  });
}
