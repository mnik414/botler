"use client";
import * as React from "react";
import {
  MessageSquare, UserPlus, Target, Gauge, Coins, TrendingUp,
  Activity, Star, PieChart as PieIcon, BarChart3,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api, type Analytics } from "@/lib/api-client";
import { toFa, formatToman, formatNumber, formatCompact, LEAD_STATUS } from "@/lib/format";
import { SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync, KpiCard } from "./shared";

const PIE_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ef4444"];
const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6", contacted: "#f59e0b", converted: "#10b981", lost: "#ef4444",
};

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs space-y-1">
      {label !== undefined && <div className="text-muted-foreground mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}: {formatter ? formatter(p.value) : toFa(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  widget: "ویجت", website: "وب‌سایت", instagram: "اینستاگرام", whatsapp: "واتساپ", voice: "صوتی",
};

export function AnalyticsTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<Analytics>(() => api(`/api/analytics/${tenantId}`), [tenantId]);

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const k = data.kpis;
  const analysis = data.analysis || {};
  const channelData = (data.channels || [])
    .filter((c) => c.count > 0)
    .map((c) => ({ name: CHANNEL_LABELS[c.channel] || c.channel, value: c.count }));
  const statusData = (data.leadsByStatus || []).map((s) => ({
    name: LEAD_STATUS[s.status]?.label || s.status,
    status: s.status,
    count: s.count,
    fill: STATUS_COLORS[s.status] || "#94a3b8",
  }));
  const topQuestions: { word: string; count: number }[] = analysis.topQuestions || [];

  return (
    <div className="space-y-5">
      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <KpiCard icon={MessageSquare} label="گفتگوها" value={formatNumber(k.totalConversations)} />
        <KpiCard icon={UserPlus} label="لیدها" value={formatNumber(k.totalLeads)} accent="#f59e0b" />
        <KpiCard icon={Target} label="نرخ تبدیل" value={`${toFa(Math.round(k.conversionRate * 100))}٪`} accent="#8b5cf6" />
        <KpiCard icon={Gauge} label="اطمینان میانگین" value={`${toFa(Math.round(k.avgConfidence * 100))}٪`} accent="#06b6d4" />
        <KpiCard icon={Coins} label="توکن مصرفی" value={formatCompact(k.totalTokens)} accent="#ec4899" />
        <KpiCard icon={TrendingUp} label="درآمد" value={formatToman(k.revenue)} accent="#10b981" />
        <KpiCard icon={Activity} label="انتقال به اپراتور" value={formatNumber(k.handoffCount)} accent="#f43f5e" />
        <KpiCard icon={Star} label="رضایت میانگین" value={`${toFa(k.avgSatisfaction)} از ۵`} accent="#eab308" />
      </div>

      {/* Trend + Channels */}
      <div className="grid lg:grid-cols-3 gap-4">
        <SectionCard
          title="روند ۱۴ روزه"
          description="گفتگوها و لیدهای روزانه"
          className="lg:col-span-2"
        >
          <div className="h-72 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="aConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="aLead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(d) => toFa(new Date(d).getDate())} fontSize={11} tickLine={false} axisLine={false} reversed />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => toFa(v)} width={28} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="conversations" name="گفتگو" stroke="#10b981" strokeWidth={2} fill="url(#aConv)" />
                <Area type="monotone" dataKey="leads" name="لید" stroke="#f59e0b" strokeWidth={2} fill="url(#aLead)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="تفکیک کانال" description="از کدام کانال گفتگو می‌شود">
          {channelData.length === 0 ? (
            <EmptyState icon={PieIcon} title="داده‌ای موجود نیست" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {channelData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Leads by status + Top questions */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="لیدها بر اساس وضعیت" description="گزارش سرنخ‌های فروش">
          <div className="h-64 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} reversed />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => toFa(v)} width={28} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" name="تعداد" radius={[6, 6, 0, 0]}>
                  {statusData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="تحلیل گفتگوها" description="موضوعات پرتکرار و شاخص‌ها">
          <div className="space-y-4">
            {/* Indicators */}
            <div className="grid grid-cols-3 gap-2">
              <Indicator label="نرخ انتقال" value={`${toFa(Math.round((analysis.handoffRate || 0) * 100))}٪`} icon={HeadphonesMini} />
              <Indicator label="نرخ لیدگیری" value={`${toFa(Math.round((analysis.conversionRate || 0) * 100))}٪`} icon={UserPlus} />
              <Indicator label="رضایت" value={`${toFa(analysis.avgSatisfaction || 0)}/۵`} icon={Star} />
            </div>

            {/* Top questions */}
            <div>
              <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                <BarChart3 className="size-3.5 text-muted-foreground" /> کلمات پرتکرار در سوالات
              </div>
              {topQuestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">داده‌ای برای نمایش موجود نیست.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto scroll-area">
                  {topQuestions.map((q, i) => {
                    const max = topQuestions[0].count || 1;
                    const p = Math.round((q.count / max) * 100);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs w-20 truncate" dir="rtl">{q.word}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${p}%` }} />
                        </div>
                        <span className="text-[11px] tabular-nums text-muted-foreground w-6 text-left">{toFa(q.count)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Indicator({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/40">
      <Icon className="size-4 mx-auto text-muted-foreground mb-1" />
      <div className="font-bold text-sm tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

// tiny inline headsets icon (avoid extra import lines)
function HeadphonesMini(props: any) {
  return <Activity {...props} />;
}
