import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const since30 = new Date(Date.now() - 30 * 86400000);

  const [
    tenants,
    plans,
    users,
    conversations,
    leads,
    tokensByTenant,
    tokenAgg,
    invoices,
    revenueAgg,
    internalLeads,
    recentConversations,
  ] = await Promise.all([
    db.tenant.findMany({ include: { plan: true, subscription: true } }),
    db.plan.findMany(),
    db.user.count(),
    db.conversation.count(),
    db.lead.count(),
    // Aggregate token usage per tenant instead of loading every log row.
    db.tokenUsageLog.groupBy({ by: ["tenantId"], _sum: { tokens: true } }),
    db.tokenUsageLog.aggregate({ _sum: { tokens: true } }),
    // Only the last 30 days are needed for the trend.
    db.invoice.findMany({
      where: { status: "paid", createdAt: { gte: since30 } },
      select: { amount: true, createdAt: true },
    }),
    db.invoice.aggregate({ where: { status: "paid" }, _sum: { amount: true } }),
    db.internalLead.count(),
    // Bounded to the trend window (one row per conversation).
    db.conversation.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
  ]);

  const tokensMap = new Map(tokensByTenant.map((t) => [t.tenantId, t._sum.tokens || 0]));

  const now = new Date();
  const revenueByDay = new Map<string, number>();
  for (const inv of invoices) {
    const key = inv.createdAt.toISOString().slice(0, 10);
    revenueByDay.set(key, (revenueByDay.get(key) || 0) + inv.amount);
  }
  const conversationsByDay = new Map<string, number>();
  for (const c of recentConversations) {
    const key = c.createdAt.toISOString().slice(0, 10);
    conversationsByDay.set(key, (conversationsByDay.get(key) || 0) + 1);
  }
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { date: key, revenue: revenueByDay.get(key) || 0, conversations: conversationsByDay.get(key) || 0 };
  });

  // MRR counts only paid/active subscriptions — trials and suspended workspaces
  // are not revenue.
  const payingTenants = tenants.filter(
    (t) => t.subscription?.status === "active" && t.status !== "suspended"
  );
  const byPlan = plans.map((p) => {
    const count = payingTenants.filter((t) => t.planId === p.id).length;
    return { plan: p.name, code: p.code, count, revenue: count * p.priceMonthly };
  });

  const topTenants = payingTenants
    .map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan?.name,
      status: t.status,
      createdAt: t.createdAt,
      mrr: t.plan?.priceMonthly || 0,
      tokens: tokensMap.get(t.id) || 0,
    }))
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 8);

  return NextResponse.json({
    kpis: {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "active").length,
      totalUsers: users,
      totalConversations: conversations,
      totalLeads: leads,
      totalInternalLeads: internalLeads,
      mrr: payingTenants.reduce((s, t) => s + (t.plan?.priceMonthly || 0), 0),
      totalRevenue: revenueAgg._sum.amount || 0,
      totalTokens: tokenAgg._sum.tokens || 0,
    },
    plans: byPlan,
    topTenants,
    revenueTrend: last30,
    tokenUsageByTenant: tenants
      .map((t) => ({ id: t.id, name: t.name, tokens: tokensMap.get(t.id) || 0 }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10),
  });
}
