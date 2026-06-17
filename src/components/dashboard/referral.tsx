"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gift, Copy, MousePointerClick, UserPlus, Coins, TrendingUp,
  Sparkles, Share2, Loader2, CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatToman, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, useAsync, KpiCard } from "./shared";

interface ReferralData {
  id: string;
  code: string;
  clicks: number;
  signups: number;
  credits: number;
  commission: number;
}

export function ReferralTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<ReferralData>(() => api(`/api/referral/${tenantId}`), [tenantId]);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<"click" | "signup" | null>(null);

  const recordEvent = async (event: "click" | "signup") => {
    setBusy(event);
    try {
      await api(`/api/referral/${tenantId}`, { method: "POST", body: JSON.stringify({ event }) });
      toast.success(event === "click" ? "یک کلیک شبیه‌سازی ثبت شد." : "یک ثبت‌نام شبیه‌سازی ثبت شد و اعتبار اضافه شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setBusy(null);
    }
  };

  const copyLink = () => {
    if (!data) return;
    const link = `${window.location.origin}/?ref=${data.code}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success("لینک معرفی کپی شد.");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const link = `${typeof window !== "undefined" ? window.location.origin : "https://platform.com"}/?ref=${data.code}`;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="bg-gradient-to-l from-primary/10 via-card to-card border-primary/30 overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
            <div className="flex items-start gap-3">
              <div className="grid place-items-center size-12 rounded-2xl bg-primary text-primary-foreground shrink-0">
                <Gift className="size-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg">برنامه همکاری در فروش</h2>
                <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
                  با معرفی پلتفرم به دیگر کسب‌وکارها، به ازای هر ثبت‌نام موفق ۱۰۰٬۰۰۰ تومان اعتبار رایگان و ۵۰٬۰۰۰ تومان پورسانت دریافت کنید.
                </p>
              </div>
            </div>
            <Button onClick={copyLink} className="gap-1.5 shrink-0">
              {copied ? <CheckCircle2 className="size-4" /> : <Share2 className="size-4" />}
              {copied ? "کپی شد!" : "اشتراک‌گذاری لینک"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Referral code + link */}
      <SectionCard title="کد و لینک معرفی شما" description="این لینک را با کسب‌وکارهای دیگر به اشتراک بگذارید">
        <div className="grid sm:grid-cols-[1fr_1fr] gap-3">
          <div>
            <label className="text-xs text-muted-foreground">کد معرفی</label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={data.code} readOnly dir="ltr" className="font-mono font-bold" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(data.code); toast.success("کد کپی شد."); }}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">لینک معرفی</label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={link} readOnly dir="ltr" className="text-xs" />
              <Button variant="outline" size="icon" onClick={copyLink}>
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={MousePointerClick} label="کلیک‌ها" value={formatNumber(data.clicks)} hint="تعداد بازدید از لینک" />
        <KpiCard icon={UserPlus} label="ثبت‌نام‌ها" value={formatNumber(data.signups)} accent="#10b981" hint="کسب‌وکارهای عضو شده" />
        <KpiCard icon={Coins} label="اعتبار رایگان" value={formatToman(data.credits)} accent="#f59e0b" hint="اعتبار استفاده‌نشده" />
        <KpiCard icon={TrendingUp} label="پورسانت کسب‌شده" value={formatToman(data.commission)} accent="#8b5cf6" hint="درآمد شما از معرفی" />
      </div>

      {/* Simulator */}
      <SectionCard
        title="شبیه‌ساز حلقه رشد"
        description="برای تست مکانیزم حلقه رشد، می‌توانید رویدادهای کلیک و ثبت‌نام را شبیه‌سازی کنید"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy !== null}
              onClick={() => recordEvent("click")}
            >
              {busy === "click" ? <Loader2 className="size-4 animate-spin" /> : <MousePointerClick className="size-4" />}
              ثبت کلیک شبیه‌سازی
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy !== null}
              onClick={() => recordEvent("signup")}
            >
              {busy === "signup" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              ثبت ثبت‌نام شبیه‌سازی
            </Button>
          </div>
        }
      >
        <div className="text-sm text-muted-foreground leading-7">
          <p className="mb-3">حلقه رشد (Growth Loop) چگونه کار می‌کند؟</p>
          <ol className="space-y-2 list-decimal pr-5">
            <li>مشتری شما با منشی هوشمند گفتگو می‌کند و سوال می‌پرسد.</li>
            <li>منشی هوشمند تشخیص می‌دهد که این شخص خودش صاحب یک کسب‌وکار است (با تشخیص سیگنال‌هایی مانند «فروشگاه دارم»، «کسب‌وکار من…»).</li>
            <li>این شخص به‌صورت خودکار به عنوان <span className="text-primary font-medium">لید داخلی</span> در داشبورد شما ثبت می‌شود.</li>
            <li>منشی به او پیشنهاد می‌دهد که می‌تواند برای کسب‌وکار خودش هم منشی هوشمند بسازد — همراه با کد معرفی شما.</li>
            <li>اگر او ثبت‌نام کند، شما ۱۰۰٬۰۰۰ تومان اعتبار رایگان و ۵۰٬۰۰۰ تومان پورسانت دریافت می‌کنید.</li>
          </ol>
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2 text-xs">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span>این مکانیزم باعث می‌شود هر مشتری شما، فرصت تبدیل شدن به یک مشتری جدید برای پلتفرم باشد — بدون هزینه تبلیغات.</span>
          </div>
        </div>
      </SectionCard>

      {/* Become a partner */}
      <SectionCard
        title="شریک فعالیتی شو"
        description="برای کسب درآمد بیشتر از معرفی پلتفرم"
        action={
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => toast.info("به‌زودی!")}>
            درخواست همکاری رسمی
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground leading-7">
          علاوه بر اعتبار رایگان، اگر حجم معرفی‌های شما بالا باشد، می‌توانید به‌عنوان <span className="font-medium text-foreground">همکار رسمی فروش</span> پذیرفته شوید و
          از هر مشتری معرفی‌شده ۲۰٪ مبلغ اشتراک ماهانه را به‌صورت دائمی دریافت کنید. برای اطلاعات بیشتر با تیم فروش ما در تماس باشید.
        </p>
      </SectionCard>
    </div>
  );
}
