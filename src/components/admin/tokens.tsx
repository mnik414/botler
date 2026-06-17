"use client";
import { useAsync, StatCard, CardSkeletons, ErrorState, SectionCard, CHART_COLORS } from "./shared";
import { api, type AdminStats } from "@/lib/api-client";
import { formatToman, formatNumber, formatCompact, toFa } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Cpu, Zap, TrendingUp, Bot } from "lucide-react";

const MODELS = [
  { code: "glm-4.6", name: "GLM-4.6", tier: "پیشرفته", desc: "بهترین کیفیت برای گفتگوهای پیچیده و استدلال چندمرحله‌ای. مصرف توکن بالا.", color: "#10b981" },
  { code: "glm-4.5", name: "GLM-4.5", tier: "متوسط", desc: "تعادل کیفیت و هزینه. مناسب اکثر کسب‌وکارها.", color: "#14b8a6" },
  { code: "glm-4-flash", name: "GLM-4-Flash", tier: "اقتصادی", desc: "سریع و کم‌هزینه. مناسب پاسخ‌های کوتاه و پرتکرار.", color: "#f59e0b" },
];

export function AdminTokens() {
  const { data, loading, error, reload } = useAsync<AdminStats>(() => api("/api/admin/stats"), []);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeletons count={3} />
        <Card className="p-5"><div className="bg-accent animate-pulse rounded-md h-64 w-full" /></Card>
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error || "اطلاعات یافت نشد"} onReload={reload} />;
  }

  const k = data.kpis;
  const tokenData = data.tokenUsageByTenant.slice(0, 10);
  const topByTokens = [...data.topTenants]
    .map((t) => ({ ...t, tokens: tokenData.find((x) => x.name === t.name)?.tokens || t.tokens }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10);
  const totalTokens = tokenData.reduce((s, t) => s + t.tokens, 0);

  return (
    <div className="space-y-4">
      {/* Token KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="مجموع توکن" value={formatCompact(k.totalTokens)} hint={formatNumber(k.totalTokens) + " توکن"} icon={<Cpu className="size-4" />} accent="primary" />
        <StatCard label="میانگین هر کسب‌وکار" value={formatCompact(k.totalTenants > 0 ? Math.round(k.totalTokens / k.totalTenants) : 0)} hint="تقسیم بر کل کسب‌وکارها" icon={<TrendingUp className="size-4" />} accent="teal" />
        <StatCard label="برترین مصرف‌کننده" value={tokenData[0] ? formatCompact(tokenData[0].tokens) : "—"} hint={tokenData[0]?.name || ""} icon={<Zap className="size-4" />} accent="amber" />
        <StatCard label="هزینه تقریبی توکن" value={formatToman(Math.round(k.totalTokens * 0.02))} hint="محاسبه بر اساس ۲ ریال/توکن" icon={<Cpu className="size-4" />} accent="pink" />
      </div>

      {/* Token usage by tenant */}
      <SectionCard title="مصرف توکن به تفکیک کسب‌وکار" description="۱۰ کسب‌وکار برتر بر اساس مصرف توکن">
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tokenData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [formatNumber(v) + " توکن", "مصرف"]} />
              <Bar dataKey="tokens" radius={[0, 6, 6, 0]} barSize={16}>
                {tokenData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* AI Model management */}
      <SectionCard title="مدیریت مدل‌های هوش مصنوعی" description="مدل‌های موجود در پلتفرم و هزینه توکن">
        <div className="grid gap-3 md:grid-cols-3">
          {MODELS.map((m) => (
            <Card key={m.code} className="p-4 gap-0 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: m.color }} />
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-lg grid place-items-center text-white" style={{ background: m.color }}>
                    <Bot className="size-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{m.code}</div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{m.tier}</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-5">{m.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground leading-6">
          <strong className="text-foreground">نکته مدیریت توکن:</strong> هزینه توکن بر اساس مدل انتخابی هر کسب‌وکار
          محاسبه می‌شود. GLM-4-Flash برای پاسخ‌های پرتکرار و ساده پیشنهاد می‌شود تا سهمیه ماهانه بهینه‌تر مصرف شود.
          مدل‌های پیشرفته برای گفتگوهای فروش و استدلال پیچیده مناسب‌ترند. هر کسب‌وکار می‌تواند مدل را از پنل
          خود تغییر دهد.
        </div>
      </SectionCard>

      {/* Top tenants by tokens table */}
      <SectionCard title="برترین کسب‌وکارها بر اساس مصرف توکن" description="رتبه‌بندی بر اساس کل توکن مصرفی">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رتبه</TableHead>
              <TableHead>کسب‌وکار</TableHead>
              <TableHead>پلن</TableHead>
              <TableHead className="text-left">توکن</TableHead>
              <TableHead className="text-left">سهم از کل</TableHead>
              <TableHead className="text-left w-40">نسبت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topByTokens.map((t, i) => {
              const pct = totalTokens > 0 ? (t.tokens / totalTokens) * 100 : 0;
              return (
                <TableRow key={t.id}>
                  <TableCell className="text-xs text-muted-foreground font-mono">{toFa(i + 1)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">{t.slug}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] font-mono">{t.plan || "-"}</Badge></TableCell>
                  <TableCell className="text-left font-mono text-xs">
                    <div>{formatNumber(t.tokens)}</div>
                    <div className="text-[10px] text-muted-foreground">{formatCompact(t.tokens)}</div>
                  </TableCell>
                  <TableCell className="text-left text-xs text-muted-foreground font-mono">{toFa(pct.toFixed(1))}٪</TableCell>
                  <TableCell className="text-left">
                    <Progress value={pct} className="h-1.5" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
