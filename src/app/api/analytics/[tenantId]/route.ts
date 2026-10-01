import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeConversations } from "@/lib/ai-engine";
import { isResponse, requireTenantOwner } from "@/lib/auth";

const WINDOW_DAYS = 90;
const MAX_ROWS = 2000;

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId: requested } = await params;
  const auth = await requireTenantOwner(req, requested);
  if (isResponse(auth)) return auth;
  const tenantId = auth.tenantId;
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);

  const [
    tenant,
    subscription,
    totalConversations,
    totalLeads,
    conversations,
    leadsByStatusRows,
    convertedValue,
    tokenAgg,
    internalLeads,
  ] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } }),
    db.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    db.conversation.count({ where: { tenantId } }),
    db.lead.count({ where: { tenantId } }),
    // Windowed rows only — the dashboard never needs all history.
    db.conversation.findMany({
      where: { tenantId, createdAt: { gte: since } },
      select: { id: true, status: true, leadCaptured: true, satisfaction: true, confidence: true, createdAt: true, channel: true },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    }),
    db.lead.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
    db.lead.aggregate({ where: { tenantId, status: "converted" }, _sum: { value: true } }),
    db.tokenUsageLog.aggregate({ where: { tenantId }, _sum: { tokens: true } }),
    db.internalLead.count({ where: { tenantId } }),
  ]);

  const analysis = await analyzeConversations(tenantId, WINDOW_DAYS);

  const now = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    const convs = conversations.filter((c) => c.createdAt.toISOString().slice(0, 10) === key).length;
    return { date: key, conversations: convs, leads: 0 };
  });

  const channelBreakdown = ["widget", "website", "instagram", "whatsapp", "voice"].map((ch) => ({
    channel: ch,
    count: conversations.filter((c) => c.channel === ch).length,
  }));

  const statusCounts = new Map(leadsByStatusRows.map((r) => [r.status, r._count._all]));

  return NextResponse.json({
    tenant,
    subscription,
    kpis: {
      totalConversations,
      totalLeads,
      convertedLeads: statusCounts.get("converted") || 0,
      conversionRate: totalConversations ? Number((totalLeads / totalConversations).toFixed(2)) : 0,
      handoffCount: conversations.filter((c) => c.status === "handoff").length,
      avgConfidence: conversations.length
        ? Number((conversations.reduce((s, c) => s + (c.confidence || 0), 0) / conversations.length).toFixed(2))
        : 0,
      avgSatisfaction: conversations.length
        ? Number((conversations.reduce((s, c) => s + (c.satisfaction || 0), 0) / conversations.length).toFixed(1))
        : 0,
      totalTokens: tokenAgg._sum.tokens || 0,
      revenue: convertedValue._sum.value || 0,
      internalLeads,
    },
    usage: subscription
      ? {
          message: { used: subscription.messageUsage, limit: subscription.plan.messageLimit },
          conversation: { used: subscription.conversationUsage, limit: subscription.plan.conversationLimit },
          voice: { used: subscription.voiceUsage, limit: subscription.plan.voiceMinutes },
          token: { used: subscription.tokenUsage, limit: subscription.plan.tokenLimit },
        }
      : null,
    trends: last14,
    channels: channelBreakdown,
    leadsByStatus: ["new", "contacted", "converted", "lost"].map((s) => ({
      status: s,
      count: statusCounts.get(s) || 0,
    })),
    analysis,
  });
}
