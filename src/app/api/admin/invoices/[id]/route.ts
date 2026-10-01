import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";
import { addMonthsClamped } from "@/lib/date";

const ACTIONS = ["mark_paid", "mark_failed", "mark_pending"];

// PATCH /api/admin/invoices/[id] — platform admin confirms manual payments.
// Marking an invoice paid applies the plan to the tenant atomically:
// invoice → paid, subscription → active (usage reset, renewsAt extended),
// tenant.planId updated. This is the only path that fulfills an upgrade.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (typeof action !== "string" || !ACTIONS.includes(action)) {
    return NextResponse.json({ error: "action نامعتبر است" }, { status: 400 });
  }

  const existing = await db.invoice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "فاکتور یافت نشد" }, { status: 404 });

  if (action !== "mark_paid") {
    const invoice = await db.invoice.update({
      where: { id },
      data: { status: action === "mark_failed" ? "failed" : "pending" },
    });
    return NextResponse.json({ ok: true, invoice });
  }

  if (existing.status === "paid") {
    return NextResponse.json({ ok: true, invoice: existing, message: "این فاکتور قبلاً پرداخت‌شده ثبت شده است." });
  }

  const paymentRef = typeof body.paymentRef === "string" ? body.paymentRef.slice(0, 200) : "";
  const now = new Date();

  const invoice = await db.$transaction(async (tx) => {
    const paid = await tx.invoice.update({
      where: { id },
      data: { status: "paid", paidAt: now, paymentRef },
    });

    const months = paid.months > 0 ? paid.months : 1;
    const renewsAt = addMonthsClamped(now, months);

    await tx.subscription.upsert({
      where: { tenantId: paid.tenantId },
      create: {
        tenantId: paid.tenantId,
        planId: paid.planId,
        status: "active",
        renewsAt,
      },
      update: {
        planId: paid.planId,
        status: "active",
        renewsAt,
        messageUsage: 0,
        conversationUsage: 0,
        voiceUsage: 0,
        tokenUsage: 0,
      },
    });

    await tx.tenant.update({
      where: { id: paid.tenantId },
      data: { planId: paid.planId, status: "active" },
    });

    return paid;
  });

  return NextResponse.json({
    ok: true,
    invoice,
    message: "فاکتور پرداخت‌شده ثبت شد و پلن روی کسب‌وکار اعمال گردید.",
  });
}
