import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeConversations } from "@/lib/ai-engine";

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const [tenant, conversations, leads, bookings, subscription, tokenLogs, internalLeads, convos] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, include: { plan: true } }),
    db.conversation.findMany({ where: { tenantId }, select: { id: true, status: true, leadCaptured: true, satisfaction: true, confidence: true, createdAt: true, channel: true } }),
    db.lead.findMany({ where: { tenantId }, select: { id: true, status: true, value: true, createdAt: true } }),
    db.booking.findMany({ where: { tenantId }, select: { id: true, status: true, type: true } }),
    db.subscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    db.tokenUsageLog.findMany({ where: { tenantId }, select: { tokens: true, createdAt: true } }),
    db.internalLead.findMany({ where: { tenantId }, select: { id: true, score: true, status: true } }),
    (async () => analyzeConversations(tenantId))(),
  ]);

  const now = new Date();
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    const convs = conversations.filter((c) => c.createdAt.toISOString().slice(0, 10) === key).length;
    const lds = leads.filter((l) => l.createdAt.toISOString().slice(0, 10) === key).length;
    return { date: key, conversations: convs, leads: lds };
  });

  const channelBreakdown = ["widget", "website", "instagram", "whatsapp", "voice"].map((ch) => ({
    channel: ch,
    count: conversations.filter((c) => c.channel === ch).length,
  }));

  const totalTokens = tokenLogs.reduce((s, t) => s + t.tokens, 0);
  const revenue = leads.filter((l) => l.status === "converted").reduce((s, l) => s + (l.value || 0), 0);

  return NextResponse.json({
    tenant,
    subscription,
    kpis: {
      totalConversations: conversations.length,
      totalLeads: leads.length,
      convertedLeads: leads.filter((l) => l.status === "converted").length,
      conversionRate: conversations.length ? Number((leads.length / conversations.length).toFixed(2)) : 0,
      handoffCount: conversations.filter((c) => c.status === "handoff").length,
      avgConfidence: conversations.length
        ? Number((conversations.reduce((s, c) => s + (c.confidence || 0), 0) / conversations.length).toFixed(2))
        : 0,
      avgSatisfaction: conversations.length
        ? Number((conversations.reduce((s, c) => s + (c.satisfaction || 0), 0) / conversations.length).toFixed(1))
        : 0,
      totalTokens,
      revenue,
      internalLeads: internalLeads.length,
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
      count: leads.filter((l) => l.status === s).length,
    })),
    analysis: await convos,
  });
}
