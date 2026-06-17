"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare, UserPlus, Target, Gauge, Coins, TrendingUp,
  Sparkles, ArrowLeft, Phone, Bot, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api, type Analytics, type Conversation, type Lead } from "@/lib/api-client";
import { useApp } from "@/store/app-store";
import { toFa, formatToman, formatNumber, formatCompact, timeAgo, CONVO_STATUS, LEAD_STATUS } from "@/lib/format";
import { KpiCard, SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync, pct } from "./shared";

const CHART_COLORS = {
  emerald: "#10b981",
  amber: "#f59e0b",
};

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <div className="text-muted-foreground">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: {toFa(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ tenantId }: { tenantId: string }) {
  const { setDashboardTab } = useApp();
  const { data, loading, error, reload } = useAsync<Analytics>(() => api(`/api/analytics/${tenantId}`), [tenantId]);
  const convosReq = useAsync<Conversation[]>(() => api(`/api/conversations?tenantId=${tenantId}`), [tenantId]);
  const leadsReq = useAsync<Lead[]>(() => api(`/api/leads?tenantId=${tenantId}`), [tenantId]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
        <LoadingBlock lines={4} />
      </div>
    );
  }
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const k = data.kpis;
  const recentConvos = (convosReq.data || []).slice(0, 5);
  const recentLeads = (leadsReq.data || []).slice(0, 5);
  const usage = data.usage;

  const usageMeters = usage
    ? ([
        { label: "پیام", used: usage.message.used, limit: usage.message.limit, color: "bg-emerald-500" },
        { label: "گفتگو", used: usage.conversation.used, limit: usage.conversation.limit, color: "bg-teal-500" },
        { label: "دقیقه صوتی", used: usage.voice.used, limit: usage.voice.limit, color: "bg-amber-500" },
        { label: "توکن", used: usage.token.used, limit: usage.token.limit, color: "bg-rose-500" },
      ] as const)
    : [];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <KpiCard icon={MessageSquare} label="گفتگوها" value={formatNumber(k.totalConversations)} hint="کل گفتگوها" />
        <KpiCard icon={UserPlus} label="لیدها" value={formatNumber(k.totalLeads)} hint={`نرخ تبدیل ${toFa(Math.round(k.conversionRate * 100))}٪`} accent="#f59e0b" />
        <KpiCard icon={Target} label="نرخ تبدیل" value={`${toFa(Math.round(k.conversionRate * 100))}٪`} hint={`${formatNumber(k.convertedLeads)} لید تبدیل‌شده`} accent="#8b5cf6" />
        <KpiCard icon={Gauge} label="میانگین اطمینان" value={`${toFa(Math.round(k.avgConfidence * 100))}٪`} hint="اعتماد منشی به پاسخ" accent="#06b6d4" />
        <KpiCard icon={Coins} label="توکن مصرفی" value={formatCompact(k.totalTokens)} hint="این ماه" accent="#ec4899" />
        <KpiCard icon={TrendingUp} label="درآمد ثبت‌شده" value={formatToman(k.revenue)} hint="از لیدهای تبدیل‌شده" accent="#10b981" />
        <KpiCard icon={Sparkles} label="لید داخلی (Growth)" value={formatNumber(k.internalLeads)} hint="سرنخ کسب‌وکار جدید" accent="#0ea5e9" />
        <KpiCard icon={Activity} label="انتقال به اپراتور" value={formatNumber(k.handoffCount)} hint="گفتگوهای ارجاع‌شده" accent="#f43f5e" />
      </div>

      {/* Usage + Trends */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Usage */}
        <SectionCard title="مصرف این ماه" description="نسبت به سقف پلن شما">
          <div className="space-y-4">
            {usageMeters.map((m) => {
              const p = pct(m.used, m.limit);
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="tabular-nums font-medium">
                      {formatNumber(m.used)} / {formatNumber(m.limit)}
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${m.color} transition-all`} style={{ width: `${p}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{toFa(p)}٪ استفاده شده</div>
                </div>
              );
            })}
            {!usage && <p className="text-sm text-muted-foreground">اطلاعات اشتراک یافت نشد.</p>}
          </div>
        </SectionCard>

        {/* Trends */}
        <SectionCard
          title="روند ۱۴ روز اخیر"
          description="گفتگوها و لیدهای روزانه"
          className="lg:col-span-2"
          action={
            <Button variant="ghost" size="sm" onClick={() => setDashboardTab("analytics")} className="gap-1 text-muted-foreground">
              تحلیل کامل <ArrowLeft className="size-3.5" />
            </Button>
          }
        >
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => toFa(new Date(d).getDate())} fontSize={11} tickLine={false} axisLine={false} reversed />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => toFa(v)} width={28} />
                <Tooltip content={<TrendTooltip />} />
                <Area type="monotone" dataKey="conversations" name="گفتگو" stroke={CHART_COLORS.emerald} strokeWidth={2} fill="url(#gConv)" />
                <Area type="monotone" dataKey="leads" name="لید" stroke={CHART_COLORS.amber} strokeWidth={2} fill="url(#gLead)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Recent lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="گفتگوهای اخیر"
          description="آخرین تعامل مشتریان با منشی"
          action={
            <Button variant="ghost" size="sm" onClick={() => setDashboardTab("conversations")} className="gap-1 text-muted-foreground">
              همه <ArrowLeft className="size-3.5" />
            </Button>
          }
        >
          {convosReq.loading ? (
            <LoadingBlock lines={3} />
          ) : recentConvos.length === 0 ? (
            <EmptyState icon={MessageSquare} title="هنوز گفتگویی ثبت نشده" />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scroll-area -mx-1">
              {recentConvos.map((c) => {
                const st = CONVO_STATUS[c.status] || CONVO_STATUS.ai;
                return (
                  <button
                    key={c.id}
                    onClick={() => setDashboardTab("conversations")}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-accent transition text-right"
                  >
                    <div className="grid place-items-center size-9 rounded-full bg-muted text-muted-foreground shrink-0">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{c.endUserName || "مهمان"}</span>
                        {c.leadCaptured && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-emerald-500/30 text-emerald-600 py-0">
                            <UserPlus className="size-2.5" /> لید
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.channel} · {toFa(c.messageCount)} پیام · {timeAgo(c.updatedAt)}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="لیدهای اخیر"
          description="آخرین سرنخ‌های فروش"
          action={
            <Button variant="ghost" size="sm" onClick={() => setDashboardTab("leads")} className="gap-1 text-muted-foreground">
              همه <ArrowLeft className="size-3.5" />
            </Button>
          }
        >
          {leadsReq.loading ? (
            <LoadingBlock lines={3} />
          ) : recentLeads.length === 0 ? (
            <EmptyState icon={UserPlus} title="هنوز لیدی ثبت نشده" />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scroll-area -mx-1">
              {recentLeads.map((l) => {
                const st = LEAD_STATUS[l.status] || LEAD_STATUS.new;
                return (
                  <button
                    key={l.id}
                    onClick={() => setDashboardTab("leads")}
                    className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-accent transition text-right"
                  >
                    <div className="grid place-items-center size-9 rounded-full bg-amber-500/15 text-amber-600 shrink-0">
                      <Phone className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {l.phone} · {l.intent} · {timeAgo(l.createdAt)}
                      </div>
                    </div>
                    {l.value > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{formatToman(l.value)}</span>}
                    <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
