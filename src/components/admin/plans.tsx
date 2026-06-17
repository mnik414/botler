"use client";
import * as React from "react";
import { useAsync, ErrorState, SectionCard, StatCard, CHART_COLORS } from "./shared";
import { api, type Plan, type AdminStats } from "@/lib/api-client";
import { formatToman, formatNumber, formatCompact, toFa } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Star, MessageSquare, Phone, Cpu, Coins } from "lucide-react";

export function AdminPlans() {
  const plansReq = useAsync<Plan[]>(() => api("/api/plans"), []);
  const statsReq = useAsync<AdminStats>(() => api("/api/admin/stats"), []);

  const loading = plansReq.loading || statsReq.loading;
  const error = plansReq.error || statsReq.error;

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-5"><Skeleton className="h-24 w-full" /></Card>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-72 w-full" /></Card>)}
        </div>
      </div>
    );
  }
  if (error || !plansReq.data || !statsReq.data) {
    return <ErrorState message={error || "اطلاعات یافت نشد"} onReload={() => { plansReq.reload(); statsReq.reload(); }} />;
  }

  const plans = plansReq.data;
  const stats = statsReq.data;
  const planCountMap = new Map<string, { count: number; revenue: number }>(
    stats.plans.map((p) => [p.code, { count: p.count, revenue: p.revenue }])
  );
  const totalRevenue = stats.plans.reduce((s, p) => s + p.revenue, 0);
  const totalTenants = stats.plans.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-4">
      {/* Header explainer */}
      <SectionCard
        title="مدیریت تعرفه"
        description="منطق قیمت‌گذاری پلتفرم بر اساس مصرف ترکیبی است"
      >
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <BillingFactor icon={<MessageSquare className="size-4" />} title="پذیرش گفتگو" desc="هر پلن محدودیت ماهانه گفتگو دارد. محدوده از ۵۰۰ گفتگو در Starter تا نامحدود در Enterprise." />
          <BillingFactor icon={<Phone className="size-4" />} title="دقیقه صوتی" desc="تماس صوتی با منشی هوشمند. Business و Enterprise شامل سهمیه دقیقه هستند." />
          <BillingFactor icon={<Cpu className="size-4" />} title="توکن هوش مصنوعی" desc="مصرف LLM (glm-4.6/4.5/4-flash) بر اساس طول مکالمه و پایگاه دانش محاسبه می‌شود." />
        </div>
        <div className="mt-3 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground leading-6">
          <strong className="text-foreground">مدل ترکیبی:</strong> مبلغ اشتراک ماهانه (ثابت) +
          هزینه پیام اضافه (هر پیام) + هزینه لید ثبت‌شده (هر لید) + هزینه توکن فراتر از سهمیه (هر ۱K توکن) +
          هزینه دقیقه صوتی. صورتحساب در پایان دوره صادر می‌شود.
        </div>
      </SectionCard>

      {/* Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="تعداد پلن‌ها" value={formatNumber(plans.length)} icon={<Coins className="size-4" />} accent="primary" />
        <StatCard label="مجموع کسب‌وکارها" value={formatNumber(totalTenants)} accent="teal" />
        <StatCard label="درآمد ماهانه" value={formatToman(totalRevenue)} accent="amber" />
      </div>

      {/* Plan cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, i) => {
          const stat = planCountMap.get(plan.code) || { count: 0, revenue: 0 };
          const accent = CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Card key={plan.id} className="p-5 gap-0 relative overflow-hidden">
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: accent }}
              />
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {plan.popular && (
                      <Badge className="text-[10px] gap-0.5">
                        <Star className="size-2.5" /> محبوب
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">{plan.code}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-2xl font-bold">{formatToman(plan.priceMonthly)}</div>
                <div className="text-[10px] text-muted-foreground">ماهانه</div>
              </div>

              <p className="text-xs text-muted-foreground mb-3 min-h-[2.5em]">{plan.description}</p>

              <div className="grid grid-cols-2 gap-1.5 mb-3 text-xs">
                <Limit label="گفتگو/ماه" value={plan.conversationLimit === -1 || plan.conversationLimit > 99999 ? "نامحدود" : formatNumber(plan.conversationLimit)} />
                <Limit label="پیام/ماه" value={plan.messageLimit === -1 || plan.messageLimit > 99999 ? "نامحدود" : formatNumber(plan.messageLimit)} />
                <Limit label="دقیقه صوتی" value={plan.voiceMinutes === -1 ? "نامحدود" : formatNumber(plan.voiceMinutes)} />
                <Limit label="توکن/ماه" value={plan.tokenLimit === -1 || plan.tokenLimit > 99999999 ? "نامحدود" : formatCompact(plan.tokenLimit)} />
              </div>

              <div className="space-y-1 mb-4 min-h-[5.5em]">
                {plan.features.slice(0, 5).map((f, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-xs">
                    <Check className="size-3 mt-0.5 text-primary shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">کسب‌وکار</div>
                  <div className="font-bold">{formatNumber(stat.count)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">درآمد</div>
                  <div className="font-bold">{formatToman(stat.revenue)}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Revenue by plan table */}
      <SectionCard title="درآمد به تفکیک پلن" description="مجموع درآمد ماهانه بر اساس تعرفه فعلی">
        <div className="space-y-2">
          {stats.plans.map((p, i) => {
            const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
            return (
              <div key={p.code} className="flex items-center gap-3">
                <div className="w-24 text-sm font-medium shrink-0">{p.plan}</div>
                <div className="flex-1 h-6 rounded-md bg-muted/40 overflow-hidden relative">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-muted-foreground">
                    {formatNumber(p.count)} کسب‌وکار
                  </span>
                </div>
                <div className="w-32 text-left text-xs font-mono shrink-0">{formatToman(p.revenue)}</div>
                <div className="w-12 text-left text-[10px] text-muted-foreground shrink-0">{toFa(pct.toFixed(0))}٪</div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function BillingFactor({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-2.5 p-3 rounded-lg border bg-card">
      <div className="size-8 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">{icon}</div>
      <div>
        <div className="font-medium text-sm mb-0.5">{title}</div>
        <div className="text-xs text-muted-foreground leading-5">{desc}</div>
      </div>
    </div>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-1.5 rounded-md bg-muted/40">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-xs font-mono">{value}</div>
    </div>
  );
}
