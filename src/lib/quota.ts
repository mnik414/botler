import { db } from "@/lib/db";
import { addMonthsClamped } from "@/lib/date";

export interface QuotaResult {
  ok: boolean;
  reason?: string;
}

// Checks tenant status + monthly plan quota, rolling usage over when the
// subscription period has elapsed. Must be called BEFORE spending LLM tokens.
//
// Important: a trial never auto-converts to a paid `active` subscription.
// Once the trial period is over the tenant must have a paid invoice applied by
// the platform admin (see /api/admin/invoices/[id]).
export async function checkQuota(tenantId: string): Promise<QuotaResult> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, plan: true, subscription: true },
  });
  if (!tenant) return { ok: false, reason: "کسب‌وکار یافت نشد" };
  if (tenant.status === "suspended") {
    return { ok: false, reason: "این کسب‌وکار موقتاً غیرفعال شده است" };
  }

  let sub = tenant.subscription;
  if (!sub) return { ok: true };
  if (sub.status === "canceled") return { ok: false, reason: "اشتراک این کسب‌وکار لغو شده است" };
  if (sub.status === "past_due") {
    return { ok: false, reason: "پرداخت صورتحساب این کسب‌وکار به‌روز نیست. لطفاً با پشتیبانی تماس بگیرید." };
  }

  // Lazy monthly rollover (paid subscriptions only)
  if (sub.renewsAt && sub.renewsAt.getTime() <= Date.now()) {
    if (sub.status === "trial") {
      return { ok: false, reason: "دوره آزمایشی به پایان رسیده است. برای ادامه، پلن خود را تمدید کنید." };
    }
    let next = sub.renewsAt;
    while (next.getTime() <= Date.now()) next = addMonthsClamped(next, 1);
    await db.subscription.update({
      where: { tenantId },
      data: {
        messageUsage: 0,
        conversationUsage: 0,
        voiceUsage: 0,
        tokenUsage: 0,
        renewsAt: next,
      },
    });
    sub = { ...sub, messageUsage: 0, conversationUsage: 0, voiceUsage: 0, tokenUsage: 0, renewsAt: next };
  }

  const plan = tenant.plan;
  if (plan) {
    if (plan.messageLimit > 0 && sub.messageUsage >= plan.messageLimit) {
      return { ok: false, reason: "سهمیه پیام ماهانه پلن شما به پایان رسیده است" };
    }
    if (plan.tokenLimit > 0 && sub.tokenUsage >= plan.tokenLimit) {
      return { ok: false, reason: "سهمیه توکن ماهانه پلن شما به پایان رسیده است" };
    }
    if (plan.conversationLimit > 0 && sub.conversationUsage >= plan.conversationLimit) {
      return { ok: false, reason: "سهمیه گفتگوی ماهانه پلن شما به پایان رسیده است" };
    }
    if (plan.voiceMinutes > 0 && sub.voiceUsage >= plan.voiceMinutes) {
      return { ok: false, reason: "سهمیه دقیقه صوتی ماهانه پلن شما به پایان رسیده است" };
    }
  }
  return { ok: true };
}

// Atomically reserves N messages against the plan limit. Unlike checkQuota
// (plain read), the conditional UPDATE guarantees concurrent requests cannot
// all pass the limit check and overspend.
export async function reserveMessages(tenantId: string, count = 1): Promise<QuotaResult> {
  if (count <= 0) return { ok: true };
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: { select: { messageLimit: true } }, subscription: { select: { tenantId: true } } },
  });
  if (!tenant?.subscription) return { ok: true };
  const limit = tenant.plan?.messageLimit ?? 0;

  if (limit <= 0) {
    await db.subscription.update({
      where: { tenantId },
      data: { messageUsage: { increment: count } },
    });
    return { ok: true };
  }

  const updated = await db.subscription.updateMany({
    where: { tenantId, messageUsage: { lte: limit - count } },
    data: { messageUsage: { increment: count } },
  });
  if (updated.count === 0) {
    return { ok: false, reason: "سهمیه پیام ماهانه پلن شما به پایان رسیده است" };
  }
  return { ok: true };
}

// Records token usage and optional counter increments. Transactional so the
// token log and the subscription counters cannot diverge.
export async function recordUsage(
  tenantId: string,
  opts: { tokens?: number; feature?: string; model?: string; conversations?: number; voiceMinutes?: number } = {}
): Promise<void> {
  const tokens = Math.max(0, Math.round(opts.tokens || 0));
  const conversations = Math.max(0, Math.round(opts.conversations || 0));
  const voiceMinutes = Math.max(0, Math.round(opts.voiceMinutes || 0));

  const ops: any[] = [];
  if (tokens > 0) {
    ops.push(
      db.tokenUsageLog.create({
        data: { tenantId, tokens, model: (opts.model || "glm-4.6").slice(0, 100), feature: opts.feature || "chat" },
      })
    );
  }
  if (tokens > 0 || conversations > 0 || voiceMinutes > 0) {
    ops.push(
      db.subscription.updateMany({
        where: { tenantId },
        data: {
          ...(tokens > 0 ? { tokenUsage: { increment: tokens } } : {}),
          ...(conversations > 0 ? { conversationUsage: { increment: conversations } } : {}),
          ...(voiceMinutes > 0 ? { voiceUsage: { increment: voiceMinutes } } : {}),
        },
      })
    );
  }
  if (ops.length > 0) await db.$transaction(ops);
}
