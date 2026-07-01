"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { api, type Plan, type Session } from "@/lib/api-client";
import { BUSINESS_TYPES, getBusinessType } from "@/lib/business-types";
import { toFa, formatToman, formatCompact } from "@/lib/format";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  Store,
  UtensilsCrossed,
  Stethoscope,
  Building2,
  Scale,
  Plane,
  BedDouble,
  GraduationCap,
  Home,
  Briefcase,
  Star,
  Mail,
  User,
  Lock,
  PartyPopper,
  Loader2,
  type LucideIcon,
} from "lucide-react";

const BIZ_ICONS: Record<string, LucideIcon> = {
  ShoppingBag: Store,
  UtensilsCrossed,
  Stethoscope,
  Building2,
  Scale,
  Plane,
  BedDouble,
  GraduationCap,
  Home,
  Briefcase,
};

const STEPS = [
  { n: 1, label: "نوع کسب‌وکار" },
  { n: 2, label: "اطلاعات" },
  { n: 3, label: "پلن" },
  { n: 4, label: "حساب" },
];

interface FormState {
  businessType: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  website: string;
  instagram: string;
  planCode: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}

const INITIAL: FormState = {
  businessType: "",
  name: "",
  description: "",
  phone: "",
  address: "",
  website: "",
  instagram: "",
  planCode: "growth",
  ownerEmail: "",
  ownerName: "",
  ownerPassword: "",
};

export function SignupPage() {
  const { setView, setSession } = useApp();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [usdtRate, setUsdtRate] = useState<number | null>(null);

  // Phone validation (Iranian phone-like)
  const phoneValid = (v: string) => /^[\d۰-۹\-+\s()]{7,}$/.test(toEnDigits(v));
  const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  useEffect(() => {
    (async () => {
      try {
        const [planData, rateData] = await Promise.all([
          api<Plan[]>("/api/plans"),
          api<{ rate: number; source: string }>("/api/billing/usdt-rate").catch(() => null),
        ]);
        setPlans(planData);
        if (rateData) setUsdtRate(rateData.rate);
      } catch {
        // ignore
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  const tomanToUsdt = (toman: number): number => {
    if (!usdtRate || usdtRate <= 0) return 0;
    return Number((toman / usdtRate).toFixed(2));
  };

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 1) return !!form.businessType;
    if (step === 2) return form.name.trim().length >= 2 && phoneValid(form.phone);
    if (step === 3) return !!form.planCode;
    if (step === 4) return emailValid(form.ownerEmail) && form.ownerName.trim().length >= 2 && form.ownerPassword.trim().length >= 6;
    return false;
  };

  const submit = async () => {
    if (!emailValid(form.ownerEmail)) {
      toast.error("ایمیل معتبر وارد کنید");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/tenants", {
        method: "POST",
        body: JSON.stringify({
          businessType: form.businessType,
          name: form.name,
          description: form.description,
          phone: toEnDigits(form.phone),
          address: form.address,
          website: form.website,
          instagram: form.instagram,
          planCode: form.planCode,
          ownerEmail: form.ownerEmail.toLowerCase(),
          ownerName: form.ownerName,
          ownerPassword: form.ownerPassword,
        }),
      });
      setDone(true);
      toast.success("منشی شما ساخته شد! در حال ورود…");
      // Auto-login with user's password
      try {
        const session = await api<Session>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: form.ownerEmail.toLowerCase(), password: form.ownerPassword }),
        });
        // small delay for celebration
        setTimeout(() => setSession(session), 1400);
      } catch (e: any) {
        toast.error("ورود خودکار ناموفق بود. لطفاً دستی وارد شوید.");
        setTimeout(() => setView("login"), 1800);
      }
    } catch (e: any) {
      toast.error(e.message || "ساخت منشی ناموفق بود");
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS STATE
  if (done) {
    return (
      <div className="container mx-auto px-4 py-16 min-h-[80vh] grid place-items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="max-w-md w-full text-center py-8 border-primary/40 shadow-xl relative overflow-hidden">
            {/* Confetti dots */}
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: -10, opacity: 0 }}
                animate={{
                  y: [0, 300 + Math.random() * 200],
                  x: [(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 400],
                  opacity: [1, 1, 0],
                  rotate: Math.random() * 360,
                }}
                transition={{ duration: 1.8 + Math.random(), delay: Math.random() * 0.4 }}
                className="absolute top-4 right-1/2 size-2 rounded-sm"
                style={{
                  backgroundColor: ["#10b981", "#f59e0b", "#0ea5e9", "#ec4899", "#8b5cf6"][i % 5],
                }}
              />
            ))}
            <CardContent className="space-y-4">
              <div className="grid place-items-center size-20 rounded-full bg-primary/10 text-primary mx-auto">
                <PartyPopper className="size-10" />
              </div>
              <h2 className="text-2xl font-black">منشی شما ساخته شد!</h2>
              <p className="text-muted-foreground leading-7">
                تبریک! منشی هوشمند <span className="font-semibold text-foreground">{form.name}</span> با
                موفقیت ساخته شد. در حال ورود به پنل مدیریت…
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <Loader2 className="size-4 animate-spin" />
                در حال انتقال به داشبورد
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <Badge variant="secondary" className="mb-3 gap-1.5">
            <Sparkles className="size-3.5" />
            ساخت منشی هوشمند
          </Badge>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            منشی اختصاصی کسب‌وکار خود را بسازید
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            در ۴ مرحله ساده، منشی هوشمند خود را راه‌اندازی کنید.
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {STEPS.map((s, i) => {
              const active = step === s.n;
              const completed = step > s.n;
              return (
                <div key={s.n} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`grid place-items-center size-9 rounded-full text-sm font-bold transition-all ${
                        completed
                          ? "bg-primary text-primary-foreground"
                          : active
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {completed ? <Check className="size-4" /> : toFa(s.n)}
                    </div>
                    <div
                      className={`text-[11px] ${
                        active || completed ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {s.label}
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-colors ${
                        step > s.n ? "bg-primary" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step body */}
        <Card>
          <CardContent className="p-6 md:p-8">
            <AnimatePresence mode="wait">
              {/* STEP 1 — Business type */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold">نوع کسب‌وکار خود را انتخاب کنید</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      با انتخاب نوع، یک قالب پرامپت آماده برای منشی شما بارگذاری می‌شود.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {BUSINESS_TYPES.map((bt) => {
                      const Icon = BIZ_ICONS[bt.icon] || Briefcase;
                      const selected = form.businessType === bt.code;
                      return (
                        <button
                          key={bt.code}
                          onClick={() => update("businessType", bt.code)}
                          className={`group rounded-xl border p-4 text-center transition-all ${
                            selected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "border-border hover:border-primary/40 hover:bg-accent/50"
                          }`}
                        >
                          <div
                            className={`grid place-items-center size-11 rounded-xl mx-auto mb-2 transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary group-hover:bg-primary/15"
                            }`}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div className="text-xs font-medium">{bt.label}</div>
                          {selected && (
                            <Check className="size-3.5 text-primary mx-auto mt-1.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 2 — Business info */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold">اطلاعات کسب‌وکار</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      این اطلاعات در پروفایل عمومی و پاسخ‌های منشی استفاده می‌شود.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="name">نام کسب‌وکار *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="مثلاً کافه بامداد"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="description">توضیحات</Label>
                      <Textarea
                        id="description"
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                        placeholder="معرفی کوتاه کسب‌وکار، خدمات و امکانات…"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">شماره تماس *</Label>
                      <Input
                        id="phone"
                        dir="ltr"
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="021-12345678"
                        className="text-left"
                      />
                      {form.phone && !phoneValid(form.phone) && (
                        <p className="text-[11px] text-destructive">شماره تماس معتبر وارد کنید</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram">اینستاگرام</Label>
                      <Input
                        id="instagram"
                        dir="ltr"
                        value={form.instagram}
                        onChange={(e) => update("instagram", e.target.value)}
                        placeholder="@your_business"
                        className="text-left"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="address">آدرس</Label>
                      <Input
                        id="address"
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                        placeholder="تهران، …"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="website">وب‌سایت</Label>
                      <Input
                        id="website"
                        dir="ltr"
                        value={form.website}
                        onChange={(e) => update("website", e.target.value)}
                        placeholder="https://example.com"
                        className="text-left"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 3 — Plan */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold">پلن خود را انتخاب کنید</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      می‌توانید بعداً پلن خود را تغییر دهید. دوره آزمایشی رایگان فعال است.
                    </p>
                  </div>
                  {loadingPlans ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {plans.map((plan) => {
                        const selected = form.planCode === plan.code;
                        return (
                          <button
                            key={plan.id}
                            onClick={() => update("planCode", plan.code)}
                            className={`text-right rounded-xl border p-4 transition-all relative ${
                              selected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:bg-accent/50"
                            }`}
                          >
                            {plan.popular && (
                              <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground border-transparent text-[10px] gap-1">
                                <Star className="size-2.5" />
                                محبوب
                              </Badge>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="font-bold">{plan.name}</div>
                              {selected && <Check className="size-4 text-primary" />}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">{plan.description}</div>
                            <div className="mt-2 flex items-baseline gap-1">
                              <span className="text-lg font-black text-primary">
                                {formatToman(plan.priceMonthly)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">/ ماه</span>
                            </div>
                            {usdtRate && plan.priceMonthly > 0 ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 rounded bg-teal-500/10 text-teal-600 px-1.5 py-0.5 text-[10px] font-medium">
                                  ₮ {toFa(tomanToUsdt(plan.priceMonthly))} USDT
                                </span>
                                <span className="text-[9px] text-muted-foreground">/ ماه</span>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {formatCompact(plan.messageLimit)} پیام
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {formatCompact(plan.conversationLimit)} گفتگو
                              </Badge>
                              {plan.voiceMinutes > 0 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {toFa(plan.voiceMinutes)} دقیقه صوتی
                                </Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 4 — Account */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-bold">ساخت حساب کاربری</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      اطلاعات مدیر کسب‌وکار را وارد کنید. این حساب مالک منشی خواهد بود.
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ownerName">نام و نام خانوادگی</Label>
                      <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="ownerName"
                          value={form.ownerName}
                          onChange={(e) => update("ownerName", e.target.value)}
                          placeholder="مثلاً علی رضایی"
                          className="pr-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ownerEmail">ایمیل</Label>
                      <div className="relative">
                        <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="ownerEmail"
                          type="email"
                          dir="ltr"
                          value={form.ownerEmail}
                          onChange={(e) => update("ownerEmail", e.target.value)}
                          placeholder="you@example.com"
                          className="pr-9 text-left"
                        />
                      </div>
                      {form.ownerEmail && !emailValid(form.ownerEmail) && (
                        <p className="text-[11px] text-destructive">ایمیل معتبر وارد کنید</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerPassword">رمز عبور *</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="ownerPassword"
                        type="password"
                        dir="ltr"
                        value={form.ownerPassword}
                        onChange={(e) => update("ownerPassword", e.target.value)}
                        placeholder="حداقل ۶ کاراکتر"
                        className="pr-9 text-left"
                      />
                    </div>
                    {form.ownerPassword && form.ownerPassword.length < 6 && (
                      <p className="text-[11px] text-destructive">حداقل ۶ کاراکتر وارد کنید</p>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
                    <div className="font-semibold mb-1">خلاصه ثبت‌نام:</div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">نوع کسب‌وکار:</span>
                      <span className="font-medium">{getBusinessType(form.businessType).label}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">نام:</span>
                      <span className="font-medium">{form.name}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">پلن:</span>
                      <span className="font-medium">
                        {plans.find((p) => p.code === form.planCode)?.name || form.planCode}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nav buttons */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => (step === 1 ? setView("landing") : setStep((s) => s - 1))}
                className="gap-1.5"
              >
                <ArrowRight className="size-4" />
                {step === 1 ? "بازگشت به خانه" : "مرحله قبل"}
              </Button>
              {step < 4 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="gap-1.5">
                  مرحله بعد
                  <ArrowLeft className="size-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={!canNext() || submitting} className="gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      در حال ساخت…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      ساخت منشی
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          قبلاً حساب دارید؟{" "}
          <Button variant="link" className="p-0 h-auto font-medium" onClick={() => setView("login")}>
            وارد شوید
          </Button>
        </div>
      </div>
    </div>
  );
}

// Convert Persian digits to English
function toEnDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}
