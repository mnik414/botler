"use client";
import { useAsync, StatCard, CardSkeletons, ErrorState, SectionCard, statusBadgeClass, statusLabel, CHART_COLORS } from "./shared";
import { api, type AdminStats } from "@/lib/api-client";
import { formatToman, formatNumber, formatCompact, formatDate, toFa } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Building2, Users, MessageSquare, UserPlus, TrendingUp, Wallet, Cpu, Sparkles, Activity,
} from "lucide-react";

export function AdminOverview() {
  const { data, loading, error, reload } = useAsync<AdminStats>(() => api("/api/admin/stats"), []);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeletons count={9} />
        <Card className="p-5"><Skeleton className="h-64 w-full" /></Card>
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error || "اطلاعات یافت نشد"} onReload={reload} />;
  }

  const k = data.kpis;
  const trendData = data.revenueTrend.map((p) => ({ ...p, label: p.date.slice(5) }));
  const planData = data.plans.map((p) => ({ name: p.plan, value: p.count, code: p.code }));
  const tokenData = data.tokenUsageByTenant.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="کل کسب‌وکارها" value={formatNumber(k.totalTenants)} hint={`${formatNumber(k.activeTenants)} فعال`} icon={<Building2 className="size-4" />} accent="primary" />
        <StatCard label="کل کاربران" value={formatNumber(k.totalUsers)} icon={<Users className="size-4" />} accent="teal" />
        <StatCard label="گفتگوها" value={formatNumber(k.totalConversations)} icon={<MessageSquare className="size-4" />} accent="sky" />
        <StatCard label="کل لیدها" value={formatNumber(k.totalLeads)} icon={<UserPlus className="size-4" />} accent="pink" />
        <StatCard label="لیدهای حلقه رشد" value={formatNumber(k.totalInternalLeads)} hint="صاحبان کسب‌وکار شناسایی‌شده" icon={<Sparkles className="size-4" />} accent="violet" />
        <StatCard label="درآمد ماهانه (MRR)" value={formatToman(k.mrr)} icon={<TrendingUp className="size-4" />} accent="primary" />
        <StatCard label="درآمد کل" value={formatToman(k.totalRevenue)} icon={<Wallet className="size-4" />} accent="amber" />
        <StatCard label="توکن مصرف‌شده" value={formatCompact(k.totalTokens)} hint={formatNumber(k.totalTokens) + " توکن"} icon={<Cpu className="size-4" />} accent="teal" />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="روند درآمد ۳۰ روز اخیر"
          description="درآمد روزانه به تومان"
          className="lg:col-span-2"
        >
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                  formatter={(v: any) => [formatToman(v), "درآمد"]}
                  labelFormatter={(l) => "تاریخ: " + l}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="توزیع پلن‌ها" description="تعداد کسب‌وکار به تفکیک تعرفه">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {planData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any, n: any) => [formatNumber(v) + " کسب‌وکار", n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-1.5 mt-3">
            {planData.map((p, i) => (
              <div key={p.code} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {p.name}
                </span>
                <span className="text-muted-foreground">{formatNumber(p.value)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Token usage by tenant */}
      <SectionCard
        title="مصرف توکن به تفکیک کسب‌وکار"
        description="برترین کسب‌وکارها بر اساس مصرف توکن هوش مصنوعی"
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokenData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} formatter={(v: any) => [formatNumber(v) + " توکن", "مصرف"]} />
              <Bar dataKey="tokens" radius={[0, 6, 6, 0]} fill="#14b8a6" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Top tenants table */}
      <SectionCard title="برترین کسب‌وکارها" description="مرتب‌شده بر اساس MRR">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کسب‌وکار</TableHead>
              <TableHead>پلن</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="text-left">MRR</TableHead>
              <TableHead className="text-left">توکن</TableHead>
              <TableHead className="text-left">تاریخ عضویت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.topTenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.slug}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[10px]">{t.plan || "-"}</Badge>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(t.status)}`}>
                    {statusLabel(t.status)}
                  </span>
                </TableCell>
                <TableCell className="text-left font-mono text-xs">{formatToman(t.mrr)}</TableCell>
                <TableCell className="text-left font-mono text-xs">{formatCompact(t.tokens)}</TableCell>
                <TableCell className="text-left text-xs text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Activity className="size-3" />
        به‌روزرسانی‌شده در {toFa(new Date().toLocaleTimeString("fa-IR"))}
      </div>
    </div>
  );
}
