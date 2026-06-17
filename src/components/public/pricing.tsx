"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { api, type Plan } from "@/lib/api-client";
import { toFa, formatToman, formatCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Check, Sparkles, Bot, MessageSquare, Users, Mic, Cpu, Star, type LucideIcon } from "lucide-react";

const FAQS = [
  {
    q: "آیا می‌توانم قبل از پرداخت، پلتفرم را تست کنم؟",
    a: "بله. پس از ثبت‌نام، پلن شما در حالت آزمایشی فعال می‌شود و می‌توانید بدون پرداخت، منشی هوشمند خود را بسازید و تست کنید. همچنین نمونه دمو زنده در صفحه خانه در دسترس است.",
  },
  {
    q: "تفاوت پلن‌ها در چیست؟",
    a: "تفاوت اصلی در محدودیت پیام ماهانه، تعداد کاربران، دسترسی به تماس صوتی و تحلیل پیشرفته است. پلن گراث (محبوب) برای اکثر کسب‌وکارهای کوچک و متوسط مناسب است.",
  },
  {
    q: "آیا می‌توانم پلن خود را بعداً تغییر دهم؟",
    a: "بله. در هر زمان می‌توانید پلن خود را ارتقا یا تنزل دهید. هزینه به‌صورت روزشمار محاسبه و اعمال می‌شود.",
  },
  {
    q: "آیا برای اتصال به اینستاگرام و واتساپ هزینه جداگانه دارید؟",
    a: "خیر. در پلن گراث و بالاتر، اتصال به همه کانال‌ها (وب، اینستاگرام، واتساپ) شامل هزینه است و فقط محدودیت کل پیام ماهانه اعمال می‌شود.",
  },
];

const LIMIT_ICONS: { key: keyof Plan; icon: LucideIcon; label: string }[] = [
  { key: "messageLimit", icon: MessageSquare, label: "پیام/ماه" },
  { key: "conversationLimit", icon: Bot, label: "گفتگو/ماه" },
  { key: "voiceMinutes", icon: Mic, label: "دقیقه صوتی" },
  { key: "tokenLimit", icon: Cpu, label: "توکن" },
];

export function PricingPage() {
  const { setView } = useApp();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<Plan[]>("/api/plans");
        setPlans(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <Badge variant="secondary" className="mb-3 gap-1.5">
          <Sparkles className="size-3.5" />
          پلن‌ها و تعرفه
        </Badge>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          پلن مناسب کسب‌وکار خود را انتخاب کنید
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">
          شروع رایگان با دوره آزمایشی. بدون کارت اعتباری. ارتقا یا تنزل در هر زمان.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 mt-6 bg-muted rounded-full px-4 py-2">
          <Label htmlFor="annual-toggle" className="text-sm font-medium cursor-pointer">
            ماهانه
          </Label>
          <Switch id="annual-toggle" checked={annual} onCheckedChange={setAnnual} />
          <Label htmlFor="annual-toggle" className="text-sm font-medium cursor-pointer">
            سالانه
          </Label>
          <Badge className="bg-primary/15 text-primary border-transparent">۲ ماه رایگان</Badge>
        </div>
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-8 w-2/3 mt-3" />
              <Skeleton className="h-4 w-full mt-2" />
              <Skeleton className="h-24 w-full mt-4" />
              <Skeleton className="h-9 w-full mt-4" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
          {plans.map((plan) => {
            const displayPrice = annual ? plan.priceMonthly * 10 : plan.priceMonthly;
            const isPopular = plan.popular;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col gap-4 py-6 transition-all ${
                  isPopular ? "ring-2 ring-primary scale-[1.02] shadow-lg" : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 right-1/2 translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground border-transparent gap-1 shadow">
                      <Star className="size-3" />
                      محبوب‌ترین
                    </Badge>
                  </div>
                )}
                <CardHeader className="gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </span>
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col gap-4">
                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black">{formatToman(displayPrice)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {annual ? "در سال" : "در ماه"}
                    </div>
                    {annual && plan.priceMonthly > 0 && (
                      <div className="text-[11px] text-primary mt-1">
                        معادل {formatToman(Math.round(plan.priceMonthly * 10 / 12))} در ماه
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => setView("signup")}
                  >
                    شروع کنید
                  </Button>

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {LIMIT_ICONS.map(({ key, icon: Icon, label }) => {
                      const val = plan[key] as number;
                      return (
                        <div
                          key={key}
                          className="flex flex-col items-center justify-center gap-0.5 bg-muted/60 rounded-md py-1.5 px-1 text-center"
                        >
                          <Icon className="size-3.5 text-primary" />
                          <div className="text-[11px] font-semibold leading-none">
                            {val === 0 ? "—" : formatCompact(val)}
                          </div>
                          <div className="text-[9px] text-muted-foreground leading-none mt-0.5">{label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Features */}
                  <div className="border-t pt-3 mt-1">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">امکانات</div>
                    <ul className="space-y-2 max-h-52 overflow-y-auto scroll-area pl-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="size-4 text-primary shrink-0 mt-0.5" />
                          <span className="leading-6">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* FAQ */}
      <section className="max-w-3xl mx-auto mt-16">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-3 gap-1.5">
            <Users className="size-3.5" />
            سوالات متداول
          </Badge>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight">
            هر سوالی دارید، اینجا پاسخ داده‌ایم
          </h2>
        </div>
        <Card>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-right font-semibold">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-7">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Bottom CTA */}
      <section className="mt-16 text-center">
        <Card className="border-primary/30">
          <CardContent className="p-8 md:p-10 grid gap-4">
            <h3 className="text-2xl font-black">آماده شروع هستید؟</h3>
            <p className="text-muted-foreground max-w-xl mx-auto leading-7">
              در کمتر از ۱۰ دقیقه منشی هوشمند اختصاصی خود را بسازید و اولین مشتری را
              پاسخ دهید.
            </p>
            <div className="flex justify-center">
              <Button size="lg" onClick={() => setView("signup")} className="gap-2 text-base h-12">
                <Bot className="size-5" />
                ساخت منشی رایگان
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
