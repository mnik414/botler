import { db } from "@/lib/db";

export interface QuotaResult {
  ok: boolean;
  reason?: string;
}

// Checks tenant status + monthly plan quota, rolling usage over when the
// subscription period has elapsed. Must be called BEFORE spending LLM tokens.
export async function checkQuota(tenantId: string): Promise<QuotaResult> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, plan: true, subscription: true },
  });
  if (!tenant) return { ok: false, reason: "کسب‌وکار یافت نشد" };
  if (tenant.status === "suspended") {
    return { ok: false, reason: "این کسب‌وکار موقتاً غیرفعال شده است" };
  }

  const sub = tenant.subscription;
  if (!sub) return { ok: true };
  if (sub.status === "canceled") return { ok: false, reason: "اشتراک این کسب‌وکار لغو شده است" };

  let messageUsage = sub.messageUsage;
  let tokenUsage = sub.tokenUsage;

  // Lazy monthly rollover
  if (sub.renewsAt && sub.renewsAt.getTime() <= Date.now()) {
    const next = new Date(sub.renewsAt.getTime());
    while (next.getTime() <= Date.now()) next.setMonth(next.getMonth() + 1);
    await db.subscription.update({
      where: { tenantId },
      data: {
        messageUsage: 0,
        conversationUsage: 0,
        voiceUsage: 0,
        tokenUsage: 0,
        renewsAt: next,
        status: sub.status === "trial" ? "active" : sub.status,
      },
    });
    messageUsage = 0;
    tokenUsage = 0;
  }

  const plan = tenant.plan;
  if (plan) {
    if (plan.messageLimit > 0 && messageUsage >= plan.messageLimit) {
      return { ok: false, reason: "سهمیه پیام ماهانه پلن شما به پایان رسیده است" };
    }
    if (plan.tokenLimit > 0 && tokenUsage >= plan.tokenLimit) {
      return { ok: false, reason: "سهمیه توکن ماهانه پلن شما به پایان رسیده است" };
    }
  }
  return { ok: true };
}

// Records token usage and increments subscription counters.
export async function recordUsage(
  tenantId: string,
  opts: { tokens?: number; messages?: number; feature?: string } = {}
): Promise<void> {
  const tokens = Math.max(0, Math.round(opts.tokens || 0));
  const messages = Math.max(0, Math.round(opts.messages || 0));
  if (tokens > 0) {
    await db.tokenUsageLog.create({
      data: { tenantId, tokens, feature: opts.feature || "chat" },
    });
  }
  if (tokens > 0 || messages > 0) {
    await db.subscription.updateMany({
      where: { tenantId },
      data: {
        ...(messages > 0 ? { messageUsage: { increment: messages } } : {}),
        ...(tokens > 0 ? { tokenUsage: { increment: tokens } } : {}),
      },
    });
  }
}
