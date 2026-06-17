"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Copy, Check, Globe, Instagram, MessageSquare, Phone, Mic,
  Palette, Loader2, ExternalLink, Smartphone,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useApp } from "@/store/app-store";
import { toast } from "sonner";
import { FloatingWidget } from "@/components/widget/chat-widget";
import { SectionCard, LoadingBlock, ErrorBlock, useAsync } from "./shared";

const ACCENT_PRESETS = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#0ea5e9", "#84cc16"];

const CHANNEL_SETUP: { value: string; label: string; icon: any; instructions: string }[] = [
  {
    value: "website",
    label: "وب‌سایت",
    icon: Globe,
    instructions: "کد جاوااسکریپت زیر را در تگ <head> یا <body> وب‌سایت خود قرار دهید. ویجت به‌صورت خودکار نمایش داده می‌شود.",
  },
  {
    value: "widget",
    label: "ویجت (Chat Widget)",
    icon: MessageSquare,
    instructions: "ویجت همان پنجره شناور گفتگو است که در گوشه وب‌سایت شما نمایش داده می‌شود. با قرار دادن کد زیر فعال می‌شود.",
  },
  {
    value: "instagram",
    label: "اینستاگرام",
    icon: Instagram,
    instructions: "برای اتصال دایرکت اینستاگرام، باید یک حساب تجاری داشته باشید و از طریق Meta Business API به ما دسترسی دهید. در نسخه کامل فعال می‌شود.",
  },
  {
    value: "whatsapp",
    label: "واتساپ",
    icon: Phone,
    instructions: "برای اتصال واتساپ بیزینس، شماره خود را در پنل تنظیمات وارد کنید. از طریق WhatsApp Business API فعال می‌شود.",
  },
  {
    value: "voice",
    label: "پاسخگویی صوتی",
    icon: Mic,
    instructions: "در نسخه صوتی، یک شماره تلفن اختصاصی به شما داده می‌شود و منشی به‌صورت صوتی پاسخ مشتریان را می‌دهد.",
  },
];

export function WidgetTab({ tenantId }: { tenantId: string }) {
  const { session } = useApp();
  const { data: tenant, loading, error, reload } = useAsync<any>(() => api(`/api/tenants/${tenantId}`), [tenantId]);
  const [accent, setAccent] = React.useState<string>(tenant?.accentColor || "#10b981");
  const [savingAccent, setSavingAccent] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (tenant?.accentColor) setAccent(tenant.accentColor);
  }, [tenant?.accentColor]);

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !tenant) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-platform.com";
  const embedCode = `<!-- منشی هوشمند ${tenant.name} -->
<script src="${origin}/widget.js" async></script>
<script>
  AIReceptionist.init({
    tenantId: "${tenantId}",
    accentColor: "${accent}",
    position: "left"
  });
</script>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      toast.success("کد embed کپی شد.");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const saveAccent = async () => {
    setSavingAccent(true);
    try {
      await api(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ accentColor: accent }),
      });
      toast.success("رنگ برند ذخیره شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setSavingAccent(false);
    }
  };

  const subdomain = `${tenant.slug}.receptionist.ai`;

  return (
    <div className="space-y-5">
      {/* Subdomain + embed code */}
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="آدرس اختصاصی شما" description="صفحه عمومی کسب‌وکار شما در پلتفرم">
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
              <Globe className="size-4 text-muted-foreground" />
              <code className="text-sm font-mono flex-1" dir="ltr">{subdomain}</code>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { navigator.clipboard.writeText(subdomain); toast.success("کپی شد."); }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border">
              <ExternalLink className="size-4 text-muted-foreground" />
              <code className="text-sm font-mono flex-1" dir="ltr">receptionist.ai/{tenant.slug}</code>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { navigator.clipboard.writeText(`receptionist.ai/${tenant.slug}`); toast.success("کپی شد."); }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              کاربران می‌توانند از این آدرس‌ها مستقیماً با منشی هوشمند شما گفتگو کنند.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="کد نصب ویجت"
          description="این کد را در وب‌سایت خود قرار دهید"
          action={
            <Button size="sm" variant="outline" onClick={copyEmbed} className="gap-1.5">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "کپی شد" : "کپی کد"}
            </Button>
          }
        >
          <pre dir="ltr" className="bg-muted/40 border rounded-lg p-3 text-[11px] leading-5 overflow-x-auto max-h-48 font-mono">
{embedCode}
          </pre>
        </SectionCard>
      </div>

      {/* Customization + Live preview */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <SectionCard title="شخصی‌سازی ویجت" description="رنگ برند و پیام خوش‌آمدگویی">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>رنگ برند (Accent Color)</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccent(c)}
                    className={`size-9 rounded-lg border-2 transition ${accent === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
                <div className="flex items-center gap-2 mr-2">
                  <Palette className="size-4 text-muted-foreground" />
                  <Input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <code className="text-xs font-mono" dir="ltr">{accent}</code>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={saveAccent} disabled={savingAccent || accent === tenant.accentColor} className="gap-1.5">
                {savingAccent && <Loader2 className="size-4 animate-spin" />}
                ذخیره رنگ
              </Button>
              {accent !== tenant.accentColor && (
                <span className="text-xs text-amber-600">تغییرات ذخیره نشده</span>
              )}
            </div>

            <div className="space-y-1.5 pt-3 border-t">
              <Label>پیام خوش‌آمدگویی</Label>
              <p className="text-xs text-muted-foreground">
                برای تغییر پیام خوش‌آمدگویی به تب «تنظیم منشی» مراجعه کنید.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Live preview in phone frame */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Smartphone className="size-4 text-primary" /> پیش‌نمایش زنده
            </div>
            <div className="mx-auto w-full max-w-[280px]">
              {/* Phone frame */}
              <div className="rounded-[2rem] border-4 border-foreground/80 p-2 bg-foreground/80 shadow-2xl">
                <div className="rounded-[1.6rem] overflow-hidden bg-background h-[480px] relative">
                  <div className="absolute top-0 inset-x-0 h-6 grid place-items-center bg-foreground/80">
                    <div className="size-2 rounded-full bg-background/40" />
                  </div>
                  <div className="pt-6 h-full">
                    <FloatingWidget
                      tenantId={tenantId}
                      variant="panel"
                      initialOpen
                      accentColor={accent}
                      businessName={session?.tenant?.name}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channels setup */}
      <SectionCard title="راه‌اندازی کانال‌ها" description="دستورالعمل راه‌اندازی هر کانال">
        <div className="space-y-3">
          {CHANNEL_SETUP.map((c) => (
            <div key={c.value} className="flex items-start gap-3 p-3 rounded-lg border">
              <div className="grid place-items-center size-9 rounded-lg bg-muted text-muted-foreground shrink-0">
                <c.icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">{c.label}</span>
                  {tenant.agent?.channels?.includes(c.value) && (
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">فعال</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-5">{c.instructions}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
