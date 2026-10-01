import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { addMonthsClamped } from "@/lib/date";

const TAX_RATE = 0.09;
const CYCLE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };
// Yearly = 10 months charged (2 free), quarterly = 3 months charged
const CYCLE_MONTHS_CHARGED: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 10 };
const SELF_SERVE_PLANS = ["starter", "growth", "business"];
const OPEN_INVOICE_WINDOW_MS = 30 * 60_000;

// POST /api/billing/checkout
// Creates (or reuses) a pending invoice. Payment confirmation is performed by
// the platform admin via PATCH /api/admin/invoices/[id] — never here.
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
    if (typeof billingCycle !== "string" || !Object.hasOwn(CYCLE_MONTHS, billingCycle)) {
      return NextResponse.json({ error: "سیکل صورتحساب نامعتبر است" }, { status: 400 });
    }

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });

    // Enterprise is sales-assisted; only a super admin can self-checkout it.
    if (!SELF_SERVE_PLANS.includes(plan.code) && auth.user.role !== "super_admin") {
      return NextResponse.json({ error: "این پلن از طریق خرید آنلاین قابل انتخاب نیست. با فروش تماس بگیرید." }, { status: 403 });
    }

    const months = CYCLE_MONTHS[billingCycle];
    const subtotal = plan.priceMonthly * CYCLE_MONTHS_CHARGED[billingCycle];
    const tax = Math.round(subtotal * TAX_RATE);
    const amount = subtotal + tax;

    const periodStart = new Date();
    const periodEnd = addMonthsClamped(periodStart, months);

    // Idempotency: collapse double-clicks/replays into the open pending invoice.
    const openInvoice = await db.invoice.findFirst({
      where: {
        tenantId: auth.tenantId,
        planId: plan.id,
        billingCycle,
        status: "pending",
        createdAt: { gte: new Date(Date.now() - OPEN_INVOICE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
    });

    // Best-effort USDT quote from the cached rate (informational, manual payment)
    let usdtRate: number | null = null;
    const rateConfig = await db.platformConfig.findUnique({ where: { key: "usdt_toman_rate" } });
    if (rateConfig) {
      try {
        const parsed = JSON.parse(rateConfig.valueJson);
        if (typeof parsed?.rate === "number" && parsed.rate > 0) usdtRate = parsed.rate;
      } catch {}
    }
    const usdtAmount = usdtRate ? Number((amount / usdtRate).toFixed(2)) : null;

    const invoice =
      openInvoice ??
      (await db.invoice.create({
        data: {
          tenantId: auth.tenantId,
          planId: plan.id,
          subtotal,
          tax,
          amount,
          currency: "IRT",
          usdtRate,
          usdtAmount,
          billingCycle,
          months,
          status: "pending",
          periodStart,
          periodEnd,
        },
      }));

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
      subtotal,
      tax,
      amount,
      currency: "IRT",
      usdtRate,
      usdtAmount,
      provider: typeof provider === "string" ? provider.slice(0, 50) : "manual",
      billingCycle,
      months,
      reused: !!openInvoice,
      paymentInstructions: instructions,
      message: openInvoice
        ? "یک فاکتور در انتظار پرداخت برای این پلن وجود دارد."
        : "فاکتور ثبت شد و در انتظار تأیید پرداخت است.",
    });
  } catch (e: any) {
    console.error("[billing/checkout]", e);
    return NextResponse.json({ error: "صدور فاکتور ممکن نشد" }, { status: 500 });
  }
}
