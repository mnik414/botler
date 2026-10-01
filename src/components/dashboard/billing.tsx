"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Check, Sparkles, Zap, Crown, Building2, Loader2, Calendar, Coins, CreditCard, Bitcoin, Wallet, AlertCircle,
} from "lucide-react";
import { api, type Plan } from "@/lib/api-client";
import { toFa, formatToman, formatNumber, formatDate } from "@/lib/format";
import { TOKEN_COST_TOMAN, estimateTokenCost } from "@/lib/pricing";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, useAsync, KpiCard, pct } from "./shared";

const PLAN_ICONS: Record<string, any> = {
  starter: Zap, growth: Sparkles, business: Crown, enterprise: Building2,
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "ماهانه", quarterly: "سه‌ماهه", yearly: "سالانه",
};

export function BillingTab({ tenantId }: { tenantId: string }) {
  const tenantReq = useAsync<any>(() => api(`/api/tenants/${tenantId}`), [tenantId]);
  const plansReq = useAsync<Plan[]>(() => api("/api/plans"), []);
  const [rateReq, setRateReq] = React.useState<number | null>(null);
  const [upgradeDialog, setUpgradeDialog] = React.useState<{ plan: Plan } | null>(null);
  const [invoices, setInvoices] = React.useState<any[]>([]);

  // Fetch live USDT rate
  React.useEffect(() => {
    api<{ rate: number }>("/api/billing/usdt-rate").then((r) => setRateReq(r.rate)).catch(() => {});
  }, []);

  // Fetch real invoices
  React.useEffect(() => {
    api<any[]>(`/api/billing/invoices?tenantId=${tenantId}`).then(setInvoices).catch(() => {});
  }, [tenantId]);

  if (tenantReq.loading || plansReq.loading) return <LoadingBlock lines={4} />;
  if (tenantReq.error || !tenantReq.data) return <ErrorBlock message={tenantReq.error || undefined} onRetry={tenantReq.reload} />;
  if (plansReq.error || !plansReq.data) return <ErrorBlock message={plansReq.error || undefined} onRetry={plansReq.reload} />;

  const tenant = tenantReq.data;
  const subscription = tenant.subscription;
  const plan = subscription?.plan || tenant.plan;
  const plans = plansReq.data;
  const usdtRate = rateReq;

  const tomanToUsdt = (toman: number) => usdtRate && usdtRate > 0 ? Number((toman / usdtRate).toFixed(2)) : 0;

  const usage = subscription
    ? [
        { label: "پیام", used: subscription.messageUsage, limit: plan?.messageLimit || 0 },
        { label: "گفتگو", used: subscription.conversationUsage, limit: plan?.conversationLimit || 0 },
        { label: "دقیقه صوتی", used: subscription.voiceUsage, limit: plan?.voiceMinutes || 0 },
        { label: "توکن", used: subscription.tokenUsage, limit: plan?.tokenLimit || 0 },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* USDT rate banner */}
      {usdtRate ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-2">
          <span className="size-1.5 rounded-full bg-teal-500 animate-pulse" />
          <span>نرخ لحظه‌ای تتر: <strong className="text-teal-600">{formatNumber(usdtRate)}</strong> تومان</span>
        </div>
      ) : null}

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
            <div className="text-2xl font-bold tabular-nums mb-1">
              {plan ? formatToman(plan.priceMonthly) : "—"}
              <span className="text-xs font-normal text-muted-foreground mr-1">/ ماهانه</span>
            </div>
            {usdtRate && plan?.priceMonthly ? (
              <div className="inline-flex items-center gap-1 rounded bg-teal-500/10 text-teal-600 px-1.5 py-0.5 text-[10px] font-medium mb-2">
                ₮ {toFa(tomanToUsdt(plan.priceMonthly))} USDT /ماه
              </div>
            ) : null}
            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" />
              تمدید: {subscription?.renewsAt ? formatDate(subscription.renewsAt) : "—"}
            </div>
          </CardContent>
        </Card>

        <SectionCard title="مصرف این ماه" description="نسبت به سقف پلن" className="lg:col-span-2">
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
        <KpiCard icon={Zap} label="هزینه تخمینی توکن" value={formatToman(estimateTokenCost(subscription?.tokenUsage || 0))} hint={`بر اساس ${toFa(TOKEN_COST_TOMAN)} تومان/توکن`} accent="#f59e0b" />
        <KpiCard icon={Calendar} label="روزهای باقی‌مانده" value={toFa(Math.max(0, Math.ceil((subscription?.renewsAt ? new Date(subscription.renewsAt).getTime() - Date.now() : 0) / 86400000)))} hint="تا تمدید سیکل" accent="#06b6d4" />
      </div>

      {/* Plan switcher */}
      <SectionCard title="ارتقا پلن" description="پلن مناسب کسب‌وکار خود را انتخاب کنید">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => {
            const isCurrent = plan?.code === p.code;
            const Icon = PLAN_ICONS[p.code] || Sparkles;
            return (
              <Card key={p.id} className={`relative ${isCurrent ? "border-primary ring-1 ring-primary" : p.popular ? "border-primary/40" : ""}`}>
                <CardContent className="pt-6 space-y-3">
                  {p.popular && !isCurrent && <Badge className="absolute -top-2 right-4 text-[10px]">محبوب</Badge>}
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
                  {usdtRate && p.priceMonthly > 0 ? (
                    <div className="inline-flex items-center gap-1 rounded bg-teal-500/10 text-teal-600 px-1.5 py-0.5 text-[10px] font-medium">
                      ₮ {toFa(tomanToUsdt(p.priceMonthly))} USDT /ماه
                    </div>
                  ) : null}
                  <div className="space-y-1.5 text-[11px] text-muted-foreground min-h-[80px]">
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.messageLimit)} پیام</div>
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.conversationLimit)} گفتگو</div>
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.voiceMinutes)} دقیقه صوتی</div>
                    <div className="flex items-center gap-1.5"><Check className="size-3 text-emerald-500" /> {formatNumber(p.tokenLimit)} توکن</div>
                  </div>
                  <Button variant={isCurrent ? "outline" : "default"} className="w-full" disabled={isCurrent} onClick={() => setUpgradeDialog({ plan: p })}>
                    {isCurrent ? "پلن فعلی" : "خرید / ارتقا"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </SectionCard>

      {/* Invoices */}
      <SectionCard title="صورتحساب‌ها" description={`${toFa(invoices.length)} فاکتور`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-right font-medium py-2">شماره فاکتور</th>
                <th className="text-right font-medium py-2">مبلغ</th>
                <th className="text-right font-medium py-2 hidden sm:table-cell">تاریخ</th>
                <th className="text-right font-medium py-2">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-2.5 font-medium font-mono text-xs">{inv.id.slice(-8).toUpperCase()}</td>
                  <td className="py-2.5 tabular-nums">{formatToman(inv.amount)}</td>
                  <td className="py-2.5 text-muted-foreground hidden sm:table-cell">{formatDate(inv.createdAt)}</td>
                  <td className="py-2.5">
                    <Badge variant="outline" className={`text-[10px] ${inv.status === "paid" ? "border-emerald-500/30 text-emerald-600" : inv.status === "pending" ? "border-amber-500/30 text-amber-600" : "border-zinc-500/30 text-zinc-600"}`}>
                      {inv.status === "paid" ? "پرداخت شده" : inv.status === "pending" ? "در انتظار" : inv.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Upgrade / Purchase dialog */}
      {upgradeDialog && (
        <PurchasePlanDialog
          plan={upgradeDialog.plan}
          tenantId={tenantId}
          usdtRate={usdtRate}
          onClose={() => setUpgradeDialog(null)}
          onSuccess={() => { tenantReq.reload(); setUpgradeDialog(null); }}
        />
      )}
    </div>
  );
}

// ── Purchase / Upgrade Plan Dialog with payment method selection ──
function PurchasePlanDialog({ plan, tenantId, usdtRate, onClose, onSuccess }: {
  plan: Plan; tenantId: string; usdtRate: number | null; onClose: () => void; onSuccess: () => void;
}) {
  const [cycle, setCycle] = React.useState("monthly");
  const [paymentMethod, setPaymentMethod] = React.useState("local_iran");
  const [submitting, setSubmitting] = React.useState(false);
  const [pendingInvoice, setPendingInvoice] = React.useState<any | null>(null);

  const price = cycle === "yearly" ? (plan.priceYearly || plan.priceMonthly * 10)
    : cycle === "quarterly" ? (plan.priceQuarterly || plan.priceMonthly * 3)
    : plan.priceMonthly;
  const taxAmount = Math.round(price * 0.09);
  const total = price + taxAmount;
  const usdtAmount = usdtRate && usdtRate > 0 ? Number((total / usdtRate).toFixed(2)) : 0;

  const PAYMENT_METHODS = [
    { code: "local_iran", label: "کارت بانکی / فیش بانکی", desc: "هماهنگی پرداخت با پشتیبانی", icon: CreditCard, color: "bg-emerald-500/10 text-emerald-600" },
    { code: "usdt_trc20", label: "تتر (TRC20)", desc: `≈ ${toFa(usdtAmount)} USDT — هماهنگی با پشتیبانی`, icon: Bitcoin, color: "bg-teal-500/10 text-teal-600", network: "trc20" },
    { code: "usdt_bep20", label: "تتر (BEP20)", desc: `≈ ${toFa(usdtAmount)} USDT — هماهنگی با پشتیبانی`, icon: Bitcoin, color: "bg-amber-500/10 text-amber-600", network: "bep20" },
  ];

  const submit = async () => {
    setSubmitting(true);
    try {
      const pm = PAYMENT_METHODS.find((m) => m.code === paymentMethod);
      const network = (pm as any)?.network;
      const result = await api<any>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tenantId, type: "plan", planId: plan.id, provider: paymentMethod, billingCycle: cycle, network }),
      });

      if (result.status === "paid") {
        toast.success("پرداخت تأیید شد. پلن شما فعال شد.");
        onSuccess();
      } else {
        setPendingInvoice(result);
        toast.success("فاکتور صادر شد. برای تکمیل پرداخت با پشتیبانی هماهنگ کنید.");
      }
    } catch (e: any) {
      toast.error(e.message || "خطا در صدور فاکتور");
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingInvoice) {
    return <PendingInvoiceDialog result={pendingInvoice} onClose={() => { onSuccess(); }} />;
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> خرید پلن {plan.name}
          </DialogTitle>
          <DialogDescription>سیکل و روش پرداخت را انتخاب کنید</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Billing cycle */}
          <div className="space-y-2">
            <Label className="text-xs">سیکل صورتحساب</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["monthly", "quarterly", "yearly"] as const).map((c) => {
                const sel = cycle === c;
                const p = c === "yearly" ? (plan.priceYearly || plan.priceMonthly * 10)
                  : c === "quarterly" ? (plan.priceQuarterly || plan.priceMonthly * 3)
                  : plan.priceMonthly;
                return (
                  <button key={c} type="button" onClick={() => setCycle(c)}
                    className={`rounded-lg border p-3 text-center transition ${sel ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/40"}`}>
                    <div className="text-xs font-medium mb-1">{CYCLE_LABEL[c]}</div>
                    <div className="text-sm font-bold tabular-nums">{formatToman(p)}</div>
                    {c === "yearly" && <div className="text-[10px] text-emerald-600 mt-0.5">۲ ماه رایگان</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price summary */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">قیمت پلن</span>
              <span className="tabular-nums">{formatToman(price)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">مالیات (۹٪)</span>
              <span className="tabular-nums">{formatToman(taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1.5 font-medium">
              <span>مبلغ نهایی</span>
              <span className="tabular-nums text-primary">{formatToman(total)}</span>
            </div>
            {usdtAmount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-teal-600">
                <span>معادل USDT</span>
                <span className="tabular-nums">₮ {toFa(usdtAmount)} USDT</span>
              </div>
            )}
          </div>

          {/* Payment method — radio-style buttons */}
          <div className="space-y-2">
            <Label className="text-xs">روش پرداخت</Label>
            <div className="space-y-1.5">
              {PAYMENT_METHODS.map((m) => {
                const sel = paymentMethod === m.code;
                const Icon = m.icon;
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => setPaymentMethod(m.code)}
                    className={`flex items-center gap-3 w-full rounded-lg border p-3 text-right transition ${
                      sel ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    {/* Radio indicator */}
                    <div className={`grid place-items-center size-5 rounded-full border-2 shrink-0 ${sel ? "border-primary" : "border-muted-foreground/30"}`}>
                      {sel && <div className="size-2.5 rounded-full bg-primary" />}
                    </div>
                    <div className={`grid place-items-center size-8 rounded-lg shrink-0 ${m.color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{m.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {paymentMethod.startsWith("usdt") && (
              <div className="flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                <AlertCircle className="size-3 shrink-0 mt-0.5" />
                <span>پس از ثبت فاکتور، کارشناسان ما برای هماهنگی پرداخت و ارسال مقصد واریز با شما تماس می‌گیرند.</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button onClick={submit} disabled={submitting} className="gap-1.5">
            {submitting ? <><Loader2 className="size-4 animate-spin" /> در حال پردازش…</> : <><Check className="size-4" /> تأیید و پرداخت</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pending invoice dialog (manual payment confirmation) ──
function PendingInvoiceDialog({ result, onClose }: { result: any; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="size-4" /> فاکتور ثبت شد</DialogTitle>
          <DialogDescription>پرداخت شما در انتظار تأیید است</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">شماره فاکتور</span>
              <span className="font-mono">{result.invoiceNumber || (result.invoiceId || "").slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">مبلغ</span>
              <span className="font-bold tabular-nums">{formatToman(result.amount || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">وضعیت</span>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">در انتظار پرداخت</Badge>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded p-2.5 leading-5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>{result.paymentInstructions || "برای هماهنگی پرداخت با پشتیبانی تماس بگیرید."}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>بستن</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
