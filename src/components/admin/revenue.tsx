"use client";
import { useAsync, StatCard, CardSkeletons, ErrorState, SectionCard, CHART_COLORS } from "./shared";
import { api, type AdminStats } from "@/lib/api-client";
import { formatToman, formatNumber, formatCompact, formatDate, toFa } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, Wallet, Receipt, Calculator } from "lucide-react";

export function AdminRevenue() {
  const { data, loading, error, reload } = useAsync<AdminStats>(() => api("/api/admin/stats"), []);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeletons count={4} />
        <Card className="p-5"><div className="bg-accent animate-pulse rounded-md h-64 w-full" /></Card>
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error || "اطلاعات یافت نشد"} onReload={reload} />;
  }

  const k = data.kpis;
  const trend = data.revenueTrend.map((p) => ({ ...p, label: p.date.slice(5) }));
  const byPlan = data.plans.map((p, i) => ({ name: p.plan, revenue: p.revenue, count: p.count, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const topByMrr = [...data.topTenants].sort((a, b) => b.mrr - a.mrr).slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Revenue KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR (درآمد ماهانه)" value={formatToman(k.mrr)} icon={<TrendingUp className="size-4" />} accent="primary" />
        <StatCard label="درآمد کل" value={formatToman(k.totalRevenue)} hint="مجموع صورتحساب‌های پرداخت‌شده" icon={<Wallet className="size-4" />} accent="amber" />
        <StatCard label="تعداد صورتحساب" value={formatNumber(data.revenueTrend.filter((p) => p.revenue > 0).length) + " دوره"} icon={<Receipt className="size-4" />} accent="teal" />
        <StatCard label="میانگین ARPU" value={formatToman(k.totalTenants > 0 ? Math.round(k.mrr / k.totalTenants) : 0)} hint="درآمد سرانه هر کسب‌وکار" icon={<Calculator className="size-4" />} accent="pink" />
      </div>

      {/* Revenue trend */}
      <SectionCard title="روند درآمد ۳۰ روز اخیر" description="درآمد روزانه به تومان">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                formatter={(v: any) => [formatToman(v), "درآمد"]}
                labelFormatter={(l) => "تاریخ: " + l}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Revenue by plan */}
      <SectionCard title="درآمد به تفکیک پلن" description="سهم هر تعرفه از کل درآمد ماهانه">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPlan} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v: any) => [formatToman(v), "درآمد"]}
              />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={60}>
                {byPlan.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Billing model explainer */}
      <SectionCard title="مدل صورتحساب" description="نحوه محاسبه هزینه ماهانه هر کسب‌وکار">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 text-sm">
          <BillingFactor title="قیمت پایه اشتراک" formula="ثابت" desc="مبلغ ماهانه پلن انتخابی" />
          <BillingFactor title="پیام اضافه" formula="هر پیام × قیمت" desc="پیام‌های فراتر از سهمیه پلن" />
          <BillingFactor title="لید ثبت‌شده" formula="هر لید × قیمت" desc="لیدهای قابل‌پیگیری ایجادشده توسط هوش مصنوعی" />
          <BillingFactor title="توکن اضافه" formula="هر ۱K توکن × قیمت" desc="مصرف LLM فراتر از سهمیه ماهانه" />
          <BillingFactor title="دقیقه صوتی" formula="هر دقیقه × قیمت" desc="تماس‌های صوتی با منشی هوشمند" />
          <BillingFactor title="گفتگو اضافه" formula="هر گفتگو × قیمت" desc="گفتگوهای فراتر از محدودیت پلن" />
          <BillingFactor title="پایگاه دانش" formula="هر مگابایت" desc="فضای ذخیره‌سازی محتوای RAG" />
          <BillingFactor title="کمیسیون ارجاع" formula="درصد از MRR" desc="پاداش دعوت کسب‌وکار جدید" />
        </div>
        <div className="mt-4 p-4 rounded-lg border bg-muted/30 text-xs leading-6">
          <strong className="text-foreground">فرمول کلی:</strong> هزینه کل = اشتراک ثابت + (پیام‌های اضافه × تعرفه پیام) +
          (لیدها × تعرفه لید) + (توکن اضافه / ۱۰۰۰ × تعرفه توکن) + (دقیقه صوتی × تعرفه دقیقه).
          صورتحساب در پایان هر دوره ماهانه صادر و بر اساس وضعیت پرداخت (paid/pending/failed) ردیابی می‌شود.
        </div>
      </SectionCard>

      {/* Top tenants by MRR */}
      <SectionCard title="برترین کسب‌وکارها بر اساس MRR" description="بیشترین درآمد ماهانه">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رتبه</TableHead>
              <TableHead>کسب‌وکار</TableHead>
              <TableHead>پلن</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="text-left">MRR</TableHead>
              <TableHead className="text-left">سهم از کل</TableHead>
              <TableHead className="text-left">عضویت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topByMrr.map((t, i) => (
              <TableRow key={t.id}>
                <TableCell className="text-xs text-muted-foreground font-mono">{toFa(i + 1)}</TableCell>
                <TableCell>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.slug}</div>
                </TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px] font-mono">{t.plan || "-"}</Badge></TableCell>
                <TableCell>
                  <span className="text-xs">{t.status === "active" ? "فعال" : t.status === "trial" ? "آزمایشی" : "معلق"}</span>
                </TableCell>
                <TableCell className="text-left font-mono text-xs">{formatToman(t.mrr)}</TableCell>
                <TableCell className="text-left text-xs text-muted-foreground font-mono">
                  {toFa(k.mrr > 0 ? ((t.mrr / k.mrr) * 100).toFixed(1) : "0")}٪
                </TableCell>
                <TableCell className="text-left text-xs text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}

function BillingFactor({ title, formula, desc }: { title: string; formula: string; desc: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="outline" className="text-[10px] font-mono">{formula}</Badge>
      </div>
      <div className="text-xs text-muted-foreground leading-5">{desc}</div>
    </div>
  );
}
