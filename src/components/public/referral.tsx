"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gift, Sparkles, TrendingUp, Users, ArrowLeft, Check, Store, Bot, Share2,
} from "lucide-react";
import { toFa, formatToman } from "@/lib/format";
import { toast } from "sonner";

interface ReferralInfo {
  code: string;
  clicks: number;
  signups: number;
  credits: number;
  commission: number;
  tenant: { id: string; name: string; slug: string; businessType: string; accentColor: string; description: string };
}

export function ReferralPage() {
  const { referralCode, setView, setActiveTenant } = useApp();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!referralCode) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        // Record the click
        const lookup = await api<ReferralInfo>(`/api/referral/by-code/${referralCode}`);
        if (!mounted) return;
        setInfo(lookup);
        // increment click on the tenant's referral
        await api(`/api/referral/${lookup.tenant.id}`, {
          method: "POST",
          body: JSON.stringify({ event: "click" }),
        }).catch(() => {});
      } catch {
        if (mounted) setInfo(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [referralCode]);

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/?ref=${referralCode}` : "";

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Skeleton className="h-48 w-full rounded-2xl mb-6" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Gift className="size-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">کد معرفی نامعتبر است</h2>
        <p className="text-muted-foreground mb-6">لینک معرفی یافت نشد یا منقضی شده است.</p>
        <Button onClick={() => setView("landing")}>بازگشت به خانه</Button>
      </div>
    );
  }

  const accent = info.tenant.accentColor;

  return (
    <div className="min-h-[60vh]">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="container mx-auto px-4 py-14 relative text-center text-white">
          <Badge className="bg-white/20 text-white border-white/30 mb-4 gap-1.5">
            <Gift className="size-3.5" /> معرفی دوستانه
          </Badge>
          <h1 className="text-2xl md:text-4xl font-extrabold mb-3">
            از طرف {info.tenant.name} به پلتفرم منشی هوشمند دعوت شدید!
          </h1>
          <p className="text-white/90 max-w-xl mx-auto leading-7">
            خودتان صاحب کسب‌وکار هستید؟ یک منشی هوش مصنوعی اختصاصی بسازید که ۲۴ ساعته پاسخگوی مشتریانتان باشد.
            با کد معرفی <Badge className="bg-white/25 text-white border-0 mx-1 font-mono">{info.code}</Badge> اعتبار رایگان دریافت کنید.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <Button size="lg" variant="secondary" className="gap-2 shadow-lg" onClick={() => setView("signup")}>
              <Sparkles className="size-4" /> شاخت منشی رایگان
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 border-white/40 text-white hover:bg-white/20 hover:text-white gap-2" onClick={() => { setActiveTenant(info.tenant.id, info.tenant.slug); setView("business"); }}>
              <Store className="size-4" /> دیدن کسب‌وکار {info.tenant.name}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Gift, title: "اعتبار رایگان", desc: "با ثبت‌نام از این لینک، ۱۰۰٬۰۰۰ تومان اعتبار هدیه بگیرید", color: "bg-emerald-500/10 text-emerald-600" },
            { icon: TrendingUp, title: "کمیسیون دائمی", desc: "برای هر مشتری جذب‌شده، ۱۰٪ کمیسیون دریافت کنید", color: "bg-amber-500/10 text-amber-600" },
            { icon: Bot, title: "منشی هوشمند", desc: "پاسخگویی، فروش، رزرو و پشتیبانی ۲۴ ساعته با هوش مصنوعی", color: "bg-pink-500/10 text-pink-600" },
          ].map((b) => (
            <Card key={b.title} className="p-5 text-center">
              <div className={`grid place-items-center size-12 mx-auto rounded-xl ${b.color} mb-3`}>
                <b.icon className="size-6" />
              </div>
              <h3 className="font-bold mb-1">{b.title}</h3>
              <p className="text-xs text-muted-foreground leading-5">{b.desc}</p>
            </Card>
          ))}
        </div>

        {/* Referrer stats */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-4 text-primary" />
            <h3 className="font-bold">آمار معرفی‌کننده: {info.tenant.name}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-extrabold text-primary">{toFa(info.clicks)}</div>
              <div className="text-xs text-muted-foreground mt-1">کلیک روی لینک</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-primary">{toFa(info.signups)}</div>
              <div className="text-xs text-muted-foreground mt-1">ثبت‌نام موفق</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-emerald-600">{formatToman(info.credits)}</div>
              <div className="text-xs text-muted-foreground mt-1">اعتبار کسب‌شده</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-extrabold text-amber-600">{formatToman(info.commission)}</div>
              <div className="text-xs text-muted-foreground mt-1">کمیسیون دریافتی</div>
            </div>
          </div>
        </Card>

        {/* How it works */}
        <Card className="p-6 mb-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> چگونه کار می‌کند؟
          </h3>
          <div className="space-y-3">
            {[
              "با این لینک ثبت‌نام کنید تا کد معرفی به‌طور خودکار ثبت شود.",
              "نوع کسب‌وکار و اطلاعات خود را وارد کنید.",
              "منشی هوشمند اختصاصی شما به‌صورت خودکار ساخته می‌شود.",
              "اعتبار هدیه به‌محض فعال‌سازی اشتراک به حساب شما افزوده می‌شود.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="grid place-items-center size-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                  {toFa(i + 1)}
                </div>
                <p className="text-sm leading-6 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Share */}
        <Card className="p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Share2 className="size-4 text-primary" /> این دعوت را به اشتراک بگذارید
          </h3>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs overflow-x-auto scroll-area" dir="ltr">
              {shareLink}
            </code>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(shareLink); toast.success("لینک کپی شد"); }}>
              <Check className="size-4" /> کپی
            </Button>
          </div>
          <Button className="w-full mt-4 gap-2" onClick={() => setView("signup")}>
            <Sparkles className="size-4" /> همین حالا منشی خود را بسازید
            <ArrowLeft className="size-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
