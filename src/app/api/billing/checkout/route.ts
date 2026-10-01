import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const TAX_RATE = 0.09;
const CYCLE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };
// Yearly = 10 months (2 free), quarterly = 3 months
const CYCLE_MONTHS_CHARGED: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 10 };

// POST /api/billing/checkout
// Creates a pending invoice. Payment confirmation is performed by the platform
// admin (or a future gateway integration) — we never mark an invoice paid here.
export async function POST(req: Request) {
  try {
    const limit = rateLimit(`checkout:${clientIp(req)}`, 10, 10 * 60_000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
    }

    const auth = await requireTenantOwner(req, body.tenantId);
    if (isResponse(auth)) return auth;

    const { planId, billingCycle = "monthly", provider = "manual" } = body;
    if (typeof planId !== "string" || !planId) {
      return NextResponse.json({ error: "planId الزامی است" }, { status: 400 });
    }
    if (typeof billingCycle !== "string" || !CYCLE_MONTHS[billingCycle]) {
      return NextResponse.json({ error: "سیکل صورتحساب نامعتبر است" }, { status: 400 });
    }

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });

    const base = plan.priceMonthly * CYCLE_MONTHS_CHARGED[billingCycle];
    const amount = Math.round(base * (1 + TAX_RATE));

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + CYCLE_MONTHS[billingCycle]);

    const invoice = await db.invoice.create({
      data: {
        tenantId: auth.tenantId,
        planId: plan.id,
        amount,
        status: "pending",
        periodStart,
        periodEnd,
      },
    });

    // Optional bank-transfer instructions from platform config
    let instructions = "";
    const config = await db.platformConfig.findUnique({ where: { key: "payment_instructions" } });
    if (config) {
      try {
        const parsed = JSON.parse(config.valueJson);
        instructions = typeof parsed?.text === "string" ? parsed.text : "";
      } catch {}
    }
    if (!instructions) {
      instructions = "فاکتور شما ثبت شد. کارشناسان ما برای هماهنگی پرداخت با شما تماس می‌گیرند.";
    }

    return NextResponse.json({
      ok: true,
      status: "pending",
      invoiceId: invoice.id,
      invoiceNumber: invoice.id.slice(-8).toUpperCase(),
      amount,
      provider,
      billingCycle,
      paymentInstructions: instructions,
      message: "فاکتور ثبت شد و در انتظار تأیید پرداخت است.",
    });
  } catch (e: any) {
    console.error("[billing/checkout]", e);
    return NextResponse.json({ error: "صدور فاکتور ممکن نشد" }, { status: 500 });
  }
}
