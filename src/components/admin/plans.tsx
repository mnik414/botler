"use client";
import * as React from "react";
import { useAsync, ErrorState, SectionCard, StatCard, CHART_COLORS } from "./shared";
import { api, type Plan, type AdminStats } from "@/lib/api-client";
import { formatToman, formatNumber, formatCompact, toFa } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Check, Star, MessageSquare, Phone, Cpu, Coins, Pencil, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

export function AdminPlans() {
  const plansReq = useAsync<Plan[]>(() => api("/api/plans"), []);
  const statsReq = useAsync<AdminStats>(() => api("/api/admin/stats"), []);
  const [editing, setEditing] = React.useState<Plan | null>(null);
  const [saving, setSaving] = React.useState(false);

  const loading = plansReq.loading || statsReq.loading;
  const error = plansReq.error || statsReq.error;

  const reloadAll = () => { plansReq.reload(); statsReq.reload(); };

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
    return <ErrorState message={error || "اطلاعات یافت نشد"} onReload={reloadAll} />;
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
        description="قیمت‌گذاری، محدودیت‌ها و ویژگی‌های هر پلن را ویرایش کنید"
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

      {/* Plan cards — editable */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan, i) => {
          const stat = planCountMap.get(plan.code) || { count: 0, revenue: 0 };
          const accent = CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Card key={plan.id} className="p-5 gap-0 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: accent }} />
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
                <Button variant="outline" size="icon" className="size-7" onClick={() => setEditing(plan)} title="ویرایش پلن">
                  <Pencil className="size-3.5" />
                </Button>
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
                  <div className="h-full transition-all" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
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

      {/* Edit dialog */}
      {editing && (
        <EditPlanDialog
          plan={editing}
          open={!!editing}
          saving={saving}
          onOpenChange={(o) => !o && setEditing(null)}
          onSave={async (patch) => {
            setSaving(true);
            try {
              await api(`/api/plans/${editing.id}`, { method: "PATCH", body: JSON.stringify(patch) });
              toast.success("پلن با موفقیت به‌روزرسانی شد.");
              setEditing(null);
              reloadAll();
            } catch (e: any) {
              toast.error(e.message || "خطا در به‌روزرسانی پلن");
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}

function EditPlanDialog({
  plan, open, onOpenChange, onSave, saving,
}: {
  plan: Plan; open: boolean; onOpenChange: (o: boolean) => void; onSave: (patch: any) => void; saving: boolean;
}) {
  const [name, setName] = React.useState(plan.name);
  const [description, setDescription] = React.useState(plan.description);
  const [price, setPrice] = React.useState(String(plan.priceMonthly));
  const [messageLimit, setMessageLimit] = React.useState(String(plan.messageLimit));
  const [conversationLimit, setConversationLimit] = React.useState(String(plan.conversationLimit));
  const [voiceMinutes, setVoiceMinutes] = React.useState(String(plan.voiceMinutes));
  const [tokenLimit, setTokenLimit] = React.useState(String(plan.tokenLimit));
  const [popular, setPopular] = React.useState(plan.popular);
  const [features, setFeatures] = React.useState<string[]>(plan.features.length ? plan.features : [""]);

  // Sync when plan changes
  React.useEffect(() => {
    setName(plan.name);
    setDescription(plan.description);
    setPrice(String(plan.priceMonthly));
    setMessageLimit(String(plan.messageLimit));
    setConversationLimit(String(plan.conversationLimit));
    setVoiceMinutes(String(plan.voiceMinutes));
    setTokenLimit(String(plan.tokenLimit));
    setPopular(plan.popular);
    setFeatures(plan.features.length ? plan.features : [""]);
  }, [plan]);

  const submit = () => {
    const patch = {
      name: name.trim(),
      description: description.trim(),
      priceMonthly: Math.max(0, parseInt(price) || 0),
      messageLimit: Math.max(0, parseInt(messageLimit) || 0),
      conversationLimit: Math.max(0, parseInt(conversationLimit) || 0),
      voiceMinutes: Math.max(0, parseInt(voiceMinutes) || 0),
      tokenLimit: Math.max(0, parseInt(tokenLimit) || 0),
      popular,
      features: features.map((f) => f.trim()).filter(Boolean),
    };
    onSave(patch);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-area">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" /> ویرایش پلن {plan.name}
          </DialogTitle>
          <DialogDescription>قیمت، محدودیت‌ها و ویژگی‌های این پلن را ویرایش کنید. تغییرات بلافاصله اعمال می‌شود.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>نام پلن</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>کد پلن</Label>
              <Input value={plan.code} disabled className="font-mono text-xs bg-muted" />
              <p className="text-[10px] text-muted-foreground">کد پلن قابل تغییر نیست</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>توضیحات</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label>قیمت ماهانه (تومان)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              dir="ltr"
              className="text-left font-mono"
            />
            <p className="text-[10px] text-muted-foreground">قیمت فعلی: {formatToman(plan.priceMonthly)}</p>
          </div>

          {/* Limits */}
          <div>
            <Label className="mb-2 block">محدودیت‌های ماهانه</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">سقف گفتگو</Label>
                <Input type="number" value={conversationLimit} onChange={(e) => setConversationLimit(e.target.value)} dir="ltr" className="text-left font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">سقف پیام</Label>
                <Input type="number" value={messageLimit} onChange={(e) => setMessageLimit(e.target.value)} dir="ltr" className="text-left font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">دقیقه صوتی</Label>
                <Input type="number" value={voiceMinutes} onChange={(e) => setVoiceMinutes(e.target.value)} dir="ltr" className="text-left font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">سقف توکن</Label>
                <Input type="number" value={tokenLimit} onChange={(e) => setTokenLimit(e.target.value)} dir="ltr" className="text-left font-mono" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">برای نامحدود کردن، عدد بزرگی وارد کنید (مثلاً ۹۹۹۹۹۹۹۹۹).</p>
          </div>

          {/* Popular toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">پلن محبوب</Label>
              <p className="text-xs text-muted-foreground">این پلن با نشان ستاره در صفحه قیمت‌ها برجسته می‌شود</p>
            </div>
            <Switch checked={popular} onCheckedChange={setPopular} />
          </div>

          {/* Features */}
          <div className="space-y-1.5">
            <Label>ویژگی‌های پلن</Label>
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={f}
                    onChange={(e) => setFeatures((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`ویژگی ${toFa(i + 1)}`}
                  />
                  {features.length > 1 && (
                    <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive" onClick={() => setFeatures((arr) => arr.filter((_, j) => j !== i))}>
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => setFeatures((arr) => [...arr, ""])}>
              <Plus className="size-3.5" /> افزودن ویژگی
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            ذخیره تغییرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
