"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Check, Sparkles, Zap, Crown, Building2, Loader2, Calendar, Coins,
} from "lucide-react";
import { api, type Plan } from "@/lib/api-client";
import { toFa, formatToman, formatNumber, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, useAsync, KpiCard, pct } from "./shared";

const PLAN_ICONS: Record<string, any> = {
  starter: Zap, growth: Sparkles, business: Crown, enterprise: Building2,
};

export function BillingTab({ tenantId }: { tenantId: string }) {
  const tenantReq = useAsync<any>(() => api(`/api/tenants/${tenantId}`), [tenantId]);
  const plansReq = useAsync<Plan[]>(() => api("/api/plans"), []);
  const [upgradingPlan, setUpgradingPlan] = React.useState<string | null>(null);

  if (tenantReq.loading || plansReq.loading) return <LoadingBlock lines={4} />;
  if (tenantReq.error || !tenantReq.data) return <ErrorBlock message={tenantReq.error || undefined} onRetry={tenantReq.reload} />;
  if (plansReq.error || !plansReq.data) return <ErrorBlock message={plansReq.error || undefined} onRetry={plansReq.reload} />;

  const tenant = tenantReq.data;
  const subscription = tenant.subscription;
  const plan = subscription?.plan || tenant.plan;
  const plans = plansReq.data;

  const usage = subscription
    ? [
        { label: "پیام", used: subscription.messageUsage, limit: plan?.messageLimit || 0 },
        { label: "گفتگو", used: subscription.conversationUsage, limit: plan?.conversationLimit || 0 },
        { label: "دقیقه صوتی", used: subscription.voiceUsage, limit: plan?.voiceMinutes || 0 },
        { label: "توکن", used: subscription.tokenUsage, limit: plan?.tokenLimit || 0 },
      ]
    : [];

  // Mock invoices for last 3 months
  const now = new Date();
  const invoices = Array.from({ length: 3 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      id: `inv-${i}`,
      period: `${toFa(d.toLocaleDateString("fa-IR", { month: "long", year: "numeric" }))}`,
      amount: plan?.priceMonthly || 0,
      status: "paid",
      date: d.toISOString(),
    };
  });

  const upgrade = (planCode: string) => {
    setUpgradingPlan(planCode);
    setTimeout(() => {
      setUpgradingPlan(null);
      toast.success(`درخواست ارتقا به پلن «${planCode}» ثبت شد. تیم فروش با شما تماس می‌گیرد.`);
    }, 800);
  };

  return (
    <div className="space-y-5">
      {/* Current plan + Usage */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground">پلن فعلی</div>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Sparkles className="size-2.5" /> {subscription?.status === "active" ? "فعال" : subscription?.status || "—"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-1">
              {(() => {
                const Icon = PLAN_ICONS[plan?.code] || Sparkles;
                return <div className="grid place-items-center size-10 rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" /></div>;
              })()}
              <div className="text-2xl font-bold">{plan?.name || "—"}</div>
            </div>
            <div className="text-2xl font-bold tabular-nums mb-3">
              {plan ? formatToman(plan.priceMonthly) : "—"}
              <span className="text-xs font-normal text-muted-foreground mr-1">/ ماهانه</span>
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" />
              تمدید: {subscription?.renewsAt ? formatDate(subscription.renewsAt) : "—"}
            </div>
          </CardContent>
        </Card>

        <SectionCard
          title="مصرف این ماه"
          description="نسبت به سقف پلن"
          className="lg:col-span-2"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {usage.map((u) => {
              const p = pct(u.used, u.limit);
              return (
                <div key={u.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{u.label}</span>
                    <span className="tabular-nums font-medium">{formatNumber(u.used)} / {formatNumber(u.limit)}</span>
                  </div>
                  <Progress value={p} className="h-2" />
                  <div className="text-[10px] text-muted-foreground mt-0.5">{toFa(p)}٪ استفاده</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Token usage + estimated cost */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard icon={Coins} label="توکن این ماه" value={formatNumber(subscription?.tokenUsage || 0)} hint="مجموع مصرف" />
        <KpiCard icon={Zap} label="هزینه تخمینی توکن" value={formatToman(Math.round((subscription?.tokenUsage || 0) * 0.5))} hint="بر اساس ۰.۵ تومان/توکن" accent="#f59e0b" />
        <KpiCard icon={Calendar} label="روزهای باقی‌مانده" value={toFa(Math.max(0, Math.ceil((subscription?.renewsAt ? new Date(subscription.renewsAt).getTime() - Date.now() : 0) / 86400000)))} hint="تا تمدید سیکل" accent="#06b6d4" />
      </div>

      {/* Plan switcher */}
      <SectionCard title="ارتقا پلن" description="پلن مناسب کسب‌وکار خود را انتخاب کنید">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => {
            const isCurrent = plan?.code === p.code;
            const Icon = PLAN_ICONS[p.code] || Sparkles;
            return (
              <Card
                key={p.id}
                className={`relative ${isCurrent ? "border-primary ring-1 ring-primary" : p.popular ? "border-primary/40" : ""}`}
              >
                <CardContent className="pt-6 space-y-3">
                  {p.popular && !isCurrent && (
                    <Badge className="absolute -top-2 right-4 text-[10px]">محبوب</Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <div className={`grid place-items-center size-9 rounded-lg ${isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="font-bold">{p.name}</div>
                  </div>
                  <div className="text-xl font-bold tabular-nums">
                    {formatToman(p.priceMonthly)}
                    <span className="text-xs font-normal text-muted-foreground mr-1">/ماه</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-muted-foreground min-h-[80px]">
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.messageLimit)} پیام</div>
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.conversationLimit)} گفتگو</div>
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.voiceMinutes)} دقیقه صوتی</div>
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.tokenLimit)} توکن</div>
                  </div>
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className="w-full"
                    disabled={isCurrent || upgradingPlan === p.code}
                    onClick={() => upgrade(p.code)}
                  >
                    {upgradingPlan === p.code ? (
                      <><Loader2 className="size-4 animate-spin" /> در حال ثبت…</>
                    ) : isCurrent ? (
                      "پلن فعلی"
                    ) : (
                      "ارتقا"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionCard>

      {/* Invoices */}
      <SectionCard title="صورتحساب‌ها" description="۳ ماه اخیر">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-right font-medium py-2">دوره</th>
                <th className="text-right font-medium py-2">مبلغ</th>
                <th className="text-right font-medium py-2 hidden sm:table-cell">تاریخ صدور</th>
                <th className="text-right font-medium py-2">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-2.5 font-medium">{inv.period}</td>
                  <td className="py-2.5 tabular-nums">{formatToman(inv.amount)}</td>
                  <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{formatDate(inv.date)}</td>
                  <td className="py-2.5">
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">پرداخت شده</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
