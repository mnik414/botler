import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// POST /api/referral/by-code/[code]/click — records a referral landing visit.
// A separate, rate-limited POST keeps GET side-effect free and lets the client
// dedupe (e.g. once per browser session).
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const limit = rateLimit(`ref-click:${clientIp(req)}`, 30, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const { code } = await params;
  if (!code || code.length > 32) return NextResponse.json({ ok: true });

  const referral = await db.referral.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true },
  });
  if (referral) {
    await db.referral.update({ where: { id: referral.id }, data: { clicks: { increment: 1 } } });
  }
  return NextResponse.json({ ok: true });
}
