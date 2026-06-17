import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [tenants, plans, users, conversations, leads, tokenLogs, invoices, internalLeads] = await Promise.all([
    db.tenant.findMany({ include: { plan: true, subscription: true } }),
    db.plan.findMany(),
    db.user.count(),
    db.conversation.count(),
    db.lead.count(),
    db.tokenUsageLog.findMany({ select: { tokens: true, tenantId: true, createdAt: true } }),
    db.invoice.findMany({ where: { status: "paid" }, select: { amount: true, createdAt: true, tenantId: true } }),
    db.internalLead.count(),
  ]);

  const now = new Date();
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      revenue: invoices.filter((inv) => inv.createdAt.toISOString().slice(0, 10) === key).reduce((s, i) => s + i.amount, 0),
      conversations: 0,
    };
  });

  const byPlan = plans.map((p) => ({
    plan: p.name,
    code: p.code,
    count: tenants.filter((t) => t.planId === p.id).length,
    revenue: tenants.filter((t) => t.planId === p.id).length * p.priceMonthly,
  }));

  const topTenants = tenants
    .map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan?.name,
      status: t.status,
      createdAt: t.createdAt,
      mrr: t.plan?.priceMonthly || 0,
      tokens: tokenLogs.filter((l) => l.tenantId === t.id).reduce((s, l) => s + l.tokens, 0),
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
      mrr: tenants.reduce((s, t) => s + (t.plan?.priceMonthly || 0), 0),
      totalRevenue: invoices.reduce((s, i) => s + i.amount, 0),
      totalTokens: tokenLogs.reduce((s, l) => s + l.tokens, 0),
    },
    plans: byPlan,
    topTenants,
    revenueTrend: last30,
    tokenUsageByTenant: topTenants.map((t) => ({ name: t.name, tokens: t.tokens })),
  });
}
