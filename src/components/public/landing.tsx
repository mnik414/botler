"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { api, type MarketplaceItem } from "@/lib/api-client";
import { BUSINESS_TYPES, getBusinessType } from "@/lib/business-types";
import { toFa } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Bot,
  ArrowLeft,
  MessageSquare,
  Brain,
  Plug,
  UserPlus,
  Headphones,
  Gauge,
  BarChart3,
  Gift,
  CheckCircle2,
  ArrowDown,
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
  Instagram,
  Phone,
  Star,
  type LucideIcon,
} from "lucide-react";

// Map business-type icon string → lucide component
const BUSINESS_ICON_MAP: Record<string, LucideIcon> = {
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

function getBizIcon(name: string): LucideIcon {
  return BUSINESS_ICON_MAP[name] || Briefcase;
}

const STATS = [
  { value: "۵۰۰+", label: "کسب‌وکار فعال" },
  { value: "۲.۴M+", label: "پیام پاسخ داده‌شده" },
  { value: "۹۸٪", label: "رضایت مشتریان" },
  { value: "۲۴/۷", label: "پاسخگویی بدون توقف" },
];

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Brain, title: "پایگاه دانش RAG", desc: "سوالات متداول، PDF، وب‌سایت و فایل‌ها را به دانش منشی تبدیل کنید." },
  { icon: Bot, title: "سازنده منشی هوشمند", desc: "با چند کلیک، منشی اختصاصی با پرامپت آماده کسب‌وکار خود بسازید." },
  { icon: Plug, title: "چند کاناله", desc: "وب‌سایت، اینستاگرام، واتساپ و تماس صوتی — همه در یک منشی." },
  { icon: UserPlus, title: "ثبت لید خودکار", desc: "اطلاعات تماس مشتری را هوشمندانه شناسایی و در CRM ذخیره کنید." },
  { icon: Headphones, title: "انتقال به اپراتور", desc: "در موارد حساس، گفتگو به اپراتور انسانی منتقل می‌شود." },
  { icon: Gauge, title: "امتیاز اطمینان", desc: "هر پاسخ با درصد اطمینان نمایش داده می‌شود تا کیفیت کنترل شود." },
  { icon: BarChart3, title: "داشبورد تحلیلی", desc: "گفتگوها، لیدها، تبدیل و مصرف توکن را به‌صورت زنده ببینید." },
  { icon: Gift, title: "سیستم ارجاع", desc: "با معرفی پلتفرم به دیگران، اعتبار رایگان دریافت کنید." },
];

const STEPS = [
  { n: 1, title: "ثبت‌نام", desc: "در کمتر از ۲ دقیقه حساب بسازید." },
  { n: 2, title: "وارد کردن دانش", desc: "سوالات متداول و اطلاعات کسب‌وکار را اضافه کنید." },
  { n: 3, title: "دریافت منشی", desc: "منشی هوشمند اختصاصی شما آماده می‌شود." },
  { n: 4, title: "استفاده در کانال‌ها", desc: "ویجت، اینستاگرام و واتساپ را متصل کنید." },
];

export function LandingPage() {
  const { setView, setActiveTenant } = useApp();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loadingMkt, setLoadingMkt] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await api<MarketplaceItem[]>("/api/marketplace");
        setItems(data.slice(0, 4));
      } catch {
        // ignore
      } finally {
        setLoadingMkt(false);
      }
    })();
  }, []);

  const talkTo = (item: MarketplaceItem) => {
    setActiveTenant(item.id, item.slug);
    setView("business");
  };

  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section className="relative grid-bg">
        <div className="container mx-auto px-4 py-16 md:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-right"
          >
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Sparkles className="size-3.5" />
              پلتفرم منشی هوش مصنوعی چندمستاجری
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              <span className="text-gradient">منشی هوش مصنوعی</span>
              <br />
              اختصاصی برای کسب‌وکار شما
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground leading-8 max-w-xl mx-auto lg:mx-0">
              یک منشی هوشمند ۲۴ ساعته که به سوالات مشتریان پاسخ می‌دهد، رزرو و
              سفارش ثبت می‌کند، لید جمع می‌کند و در موارد حساس به اپراتور ارجاع
              می‌دهد. بدون کدنویسی، در چند دقیقه.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Button size="lg" onClick={() => setView("signup")} className="gap-2 text-base h-12">
                <Bot className="size-5" />
                ساخت منشی رایگان
              </Button>
              <Button size="lg" variant="outline" onClick={() => setView("widget-demo")} className="gap-2 text-base h-12">
                <MessageSquare className="size-5" />
                مشاهده دمو
              </Button>
            </div>
            <div className="mt-6 flex items-center justify-center lg:justify-start gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" />
                بدون کارت اعتباری
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" />
                راه‌اندازی در ۲ دقیقه
              </div>
            </div>
          </motion.div>

          {/* Floating chat preview mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="absolute -top-6 -right-6 size-24 rounded-full bg-primary/20 blur-2xl" />
            <div className="absolute -bottom-6 -left-6 size-24 rounded-full bg-primary/10 blur-2xl" />
            <Card className="shadow-2xl border-primary/20 overflow-hidden">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
                <div className="grid place-items-center size-9 rounded-full bg-primary-foreground/20">
                  <Bot className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">منشی کافه بامداد</div>
                  <div className="text-[10px] opacity-80 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-300 pulse-dot" />
                    آنلاین
                  </div>
                </div>
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-transparent text-[10px]">
                  هوش مصنوعی
                </Badge>
              </div>
              <CardContent className="p-4 space-y-3 bg-muted/30 min-h-[260px]">
                {/* User msg */}
                <div className="flex justify-start">
                  <div className="bg-background border rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[80%] shadow-sm">
                    سلام، ساعات کاری کافه چنده؟ میز رزرو می‌کنید؟
                  </div>
                </div>
                {/* Bot reply */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[80%] shadow-sm">
                    سلام! کافه بامداد هر روز از ۹ صبح تا ۱۲ نیمه‌شب پذیرای شماست 🌙
                    بله، رزرو میز انجام می‌شود. لطفاً تعداد نفرات و زمان مورد نظر
                    را بفرمایید.
                  </div>
                </div>
                {/* Typing */}
                <div className="flex justify-end">
                  <div className="bg-primary/10 rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-primary typing-dot" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-primary typing-dot" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-primary typing-dot" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </CardContent>
              <div className="border-t px-4 py-2 flex items-center gap-2 bg-background">
                <input
                  disabled
                  placeholder="پیام خود را بنویسید…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button size="icon" className="size-8 rounded-full">
                  <ArrowLeft className="size-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y bg-card">
        <div className="container mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-center"
            >
              <div className="text-2xl md:text-3xl font-black text-primary">{toFa(s.value)}</div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BUSINESS TYPES */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <SectionHeader
          badge="منشی آماده"
          title="برای هر کسب‌وکاری، یک منشی"
          desc="قالب‌های آماده متناسب با نوع کسب‌وکار شما؛ فقط انتخاب کنید و منشی اختصاصی‌تان ساخته می‌شود."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-10">
          {BUSINESS_TYPES.map((bt, i) => {
            const Icon = getBizIcon(bt.icon);
            return (
              <motion.button
                key={bt.code}
                onClick={() => setView("signup")}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                whileHover={{ y: -4 }}
                className="group"
              >
                <Card className="h-full items-center justify-center text-center gap-2 py-6 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <div className="grid place-items-center size-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="size-6" />
                  </div>
                  <div className="font-semibold text-sm">{bt.label}</div>
                </Card>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-muted/30 border-y">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <SectionHeader
            badge="امکانات"
            title="هر آنچه برای یک منشی حرفه‌ای لازم دارید"
            desc="پلتفرم کامل ساخت و مدیریت منشی هوش مصنوعی، از پایگاه دانش تا تحلیل رفتار مشتری."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Card className="h-full gap-3 py-5 hover:shadow-md transition-shadow">
                    <CardContent className="space-y-2">
                      <div className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <div className="font-semibold pt-1">{f.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{f.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <SectionHeader
          badge="راه‌اندازی"
          title="در ۴ قدم ساده، منشی خود را داشته باشید"
          desc="از ثبت‌نام تا اتصال به کانال‌های مشتری، کمتر از ۱۰ دقیقه زمان می‌برد."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10 relative">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="relative"
            >
              <Card className="h-full text-center items-center gap-3 py-6">
                <div className="grid place-items-center size-12 rounded-full bg-primary text-primary-foreground font-black text-lg shadow-md">
                  {toFa(s.n)}
                </div>
                <div className="font-semibold">{s.title}</div>
                <p className="text-sm text-muted-foreground leading-6 px-2">{s.desc}</p>
              </Card>
              {i < STEPS.length - 1 && (
                <ArrowDown className="hidden lg:block absolute top-1/2 -left-3 -translate-y-1/2 size-5 text-primary/40 rotate-90" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* LIVE DEMO CTA BAND */}
      <section className="container mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl bg-gradient-to-l from-primary to-emerald-600 text-primary-foreground p-8 md:p-12 text-center shadow-xl"
        >
          <Star className="size-8 mx-auto mb-3" />
          <h3 className="text-2xl md:text-3xl font-black mb-3">
            همین حالا با یک منشی واقعی گفتگو کنید
          </h3>
          <p className="opacity-90 max-w-xl mx-auto mb-6 leading-7">
            بدون ثبت‌نام، با چند نمونه منشی فعال در پلتفرم گفتگو کنید و کیفیت
            پاسخ‌ها را از نزدیک ببینید.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setView("widget-demo")}
            className="gap-2 text-base h-12"
          >
            <MessageSquare className="size-5" />
            شروع گفتگوی زنده
          </Button>
        </motion.div>
      </section>

      {/* MARKETPLACE PREVIEW */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <SectionHeader
            badge="بازار کسب‌وکارها"
            title="نمونه‌ای از منشی‌های فعال"
            desc="کسب‌وکارهایی که همین حالا با منشی هوشمند ما کار می‌کنند."
            align="right"
          />
          <Button variant="outline" onClick={() => setView("marketplace")} className="gap-2">
            مشاهده همه
            <ArrowLeft className="size-4" />
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingMkt
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <Skeleton className="h-4 w-2/3 mt-4" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                  <Skeleton className="h-16 w-full mt-3" />
                  <Skeleton className="h-9 w-full mt-3" />
                </Card>
              ))
            : items.map((item, i) => {
                const Icon = getBizIcon(getBusinessType(item.businessType).icon);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.06 }}
                  >
                    <Card className="h-full gap-3 py-5">
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="grid place-items-center size-12 rounded-xl text-white shadow-sm"
                            style={{ backgroundColor: item.accentColor }}
                          >
                            <Icon className="size-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.businessTypeLabel}</div>
                          </div>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-6">
                            {item.description}
                          </p>
                        )}
                        <Button
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => talkTo(item)}
                        >
                          <MessageSquare className="size-4" />
                          گفتگو
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="container mx-auto px-4 py-16 md:py-20">
        <Card className="border-primary/30 bg-card overflow-hidden">
          <CardContent className="p-8 md:p-12 text-center grid gap-5">
            <Badge className="mx-auto gap-1.5 w-fit" variant="secondary">
              <Sparkles className="size-3.5" /> شروع کنید
            </Badge>
            <h3 className="text-2xl md:text-4xl font-black">
              امروز منشی هوشمند کسب‌وکار خود را بسازید
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-7">
              بدون نیاز به دانش فنی، در کمتر از ۱۰ دقیقه یک منشی ۲۴ ساعته داشته
              باشید که مشتریان شما را خوشحال می‌کند.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-2">
              <Button size="lg" onClick={() => setView("signup")} className="gap-2 text-base h-12">
                <Bot className="size-5" />
                ساخت منشی رایگان
              </Button>
              <Button size="lg" variant="outline" onClick={() => setView("pricing")} className="text-base h-12">
                مشاهده پلن‌ها
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Instagram className="size-4" /> اتصال به اینستاگرام
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="size-4" /> پشتیبانی تماس صوتی
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" /> ۷ روز ضمانت بازگشت
              </span>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SectionHeader({
  badge,
  title,
  desc,
  align = "center",
}: {
  badge: string;
  title: string;
  desc?: string;
  align?: "center" | "right";
}) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : "text-right max-w-2xl"}>
      <Badge variant="secondary" className="mb-3 gap-1.5">
        <Sparkles className="size-3" />
        {badge}
      </Badge>
      <h2 className="text-2xl md:text-3xl font-black tracking-tight">{title}</h2>
      {desc && <p className="text-muted-foreground mt-3 leading-7">{desc}</p>}
    </div>
  );
}
