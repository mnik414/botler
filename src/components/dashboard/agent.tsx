"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Save, Loader2, Wand2, Globe, MessageSquare, Instagram, Phone, Mic,
  Headphones, TrendingUp, Sparkles,
} from "lucide-react";
import { api, type AgentConfig } from "@/lib/api-client";
import { useApp } from "@/store/app-store";
import { toFa, BUSINESS_TYPE_LABELS } from "@/lib/format";
import { getBusinessType } from "@/lib/business-types";
import { toast } from "sonner";
import { FloatingWidget } from "@/components/widget/chat-widget";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SectionCard, LoadingBlock, ErrorBlock, useAsync } from "./shared";

const MODELS = [
  { value: "glm-4.6", label: "GLM-4.6 (پیشرفته)" },
  { value: "glm-4.5", label: "GLM-4.5" },
  { value: "glm-4-flash", label: "GLM-4 Flash (سریع و اقتصادی)" },
];

const CHANNELS = [
  { value: "website", label: "وب‌سایت", icon: Globe },
  { value: "widget", label: "ویجت", icon: MessageSquare },
  { value: "instagram", label: "اینستاگرام", icon: Instagram },
  { value: "whatsapp", label: "واتساپ", icon: Phone },
  { value: "voice", label: "صوتی", icon: Mic },
];

export function AgentTab({ tenantId }: { tenantId: string }) {
  const { session } = useApp();
  const { data, loading, error, reload } = useAsync<AgentConfig>(() => api(`/api/agent/${tenantId}`), [tenantId]);

  const [form, setForm] = React.useState<AgentConfig | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  React.useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data || !form) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/agent/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          systemPrompt: form.systemPrompt,
          model: form.model,
          temperature: form.temperature,
          confidenceThreshold: form.confidenceThreshold,
          greetingMessage: form.greetingMessage,
          channels: form.channels,
          voiceEnabled: form.voiceEnabled,
          humanHandoff: form.humanHandoff,
          growthLoop: form.growthLoop,
        }),
      });
      toast.success("تنظیمات منشی ذخیره شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setSaving(false);
    }
  };

  const generatePrompt = async () => {
    setGenerating(true);
    // Simulate async
    await new Promise((r) => setTimeout(r, 400));
    const bt = getBusinessType(session?.tenant?.businessType || "other");
    set("systemPrompt", bt.prompt);
    setGenerating(false);
    toast.success("پرامپت از نوع کسب‌وکار بازتولید شد.");
  };

  const toggleChannel = (ch: string, checked: boolean) => {
    set("channels", checked ? [...form.channels, ch] : form.channels.filter((c) => c !== ch));
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-4">
        <SectionCard title="هویت منشی" description="نام و پیام خوش‌آمدگویی">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>نام منشی</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="منشی هوشمند" />
            </div>
            <div className="space-y-1.5">
              <Label>پیام خوش‌آمدگویی</Label>
              <Textarea value={form.greetingMessage} onChange={(e) => set("greetingMessage", e.target.value)} rows={2} placeholder="سلام! من منشی هوشمند …" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="پرامپت سیستم (System Prompt)"
          description="دستورالعمل رفتار منشی هوشمند — این متن به عنوان زمینه به مدل داده می‌شود"
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={generating}>
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                  بازتولید پرامپت
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>بازنویسی پرامپت؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    این عملیات پرامپت فعلی را با قالب آماده برای نوع کسب‌وکار «{BUSINESS_TYPE_LABELS[session?.tenant?.businessType || ""] || "سایر"}» جایگزین می‌کند. آیا مطمئن هستید؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>انصراف</AlertDialogCancel>
                  <AlertDialogAction onClick={generatePrompt}>بله، بازنویسی کن</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        >
          <Textarea
            value={form.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            rows={10}
            className="font-mono text-xs leading-6 resize-y"
            placeholder="تو یک منشی هوشمند هستی…"
          />
        </SectionCard>

        <SectionCard title="پارامترهای مدل" description="تنظیمات فنی پاسخگویی">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>مدل زبان</Label>
              <Select value={form.model} onValueChange={(v) => set("model", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>دمای پاسخگویی (Temperature)</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{toFa(form.temperature.toFixed(2))}</span>
              </div>
              <Slider
                value={[form.temperature]}
                min={0} max={1} step={0.05}
                onValueChange={(v) => set("temperature", v[0])}
              />
              <p className="text-[11px] text-muted-foreground">مقادیر پایین‌تر = پاسخ‌های دقیق‌تر و ثابت؛ مقادیر بالاتر = پاسخ‌های خلاقانه‌تر</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>آستانه اطمینان (Confidence Threshold)</Label>
                <span className="text-xs tabular-nums text-muted-foreground">{toFa(Math.round(form.confidenceThreshold * 100))}٪</span>
              </div>
              <Slider
                value={[form.confidenceThreshold]}
                min={0} max={1} step={0.05}
                onValueChange={(v) => set("confidenceThreshold", v[0])}
              />
              <p className="text-[11px] text-muted-foreground">اگر اطمینان منشی به پاسخ کمتر از این مقدار باشد، گفتگو به اپراتور ارجاع داده می‌شود.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="کانال‌ها و امکانات" description="کانال‌های پاسخگویی و رفتار منشی">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>کانال‌های فعال</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CHANNELS.map((c) => {
                  const active = form.channels.includes(c.value);
                  return (
                    <label
                      key={c.value}
                      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
                        active ? "border-primary bg-primary/5" : "hover:bg-accent"
                      }`}
                    >
                      <Checkbox checked={active} onCheckedChange={(v) => toggleChannel(c.value, !!v)} />
                      <c.icon className="size-4 text-muted-foreground" />
                      <span className="text-sm">{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <ToggleRow
                icon={Mic}
                title="پاسخگویی صوتی"
                description="اجازه ورودی صوتی به مشتریان (در نسخه صوتی فعال می‌شود)"
                checked={form.voiceEnabled}
                onChange={(v) => set("voiceEnabled", v)}
              />
              <ToggleRow
                icon={Headphones}
                title="انتقال به اپراتور"
                description="در صورت پایین بودن اطمینان، گفتگو به اپراتور انسانی ارجاع داده شود"
                checked={form.humanHandoff}
                onChange={(v) => set("humanHandoff", v)}
              />
              <ToggleRow
                icon={TrendingUp}
                title="حلقه رشد (Growth Loop)"
                description="تشخیص خودکار صاحبان کسب‌وکار در میان مشتریان و تبدیل به لید داخلی"
                checked={form.growthLoop}
                onChange={(v) => set("growthLoop", v)}
              />
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="lg" className="gap-1.5 w-full sm:w-auto">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            ذخیره تنظیمات
          </Button>
        </div>
      </div>

      {/* Live test + summary */}
      <div className="space-y-4 lg:sticky lg:top-20 h-fit">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-primary" />
              <div className="font-semibold text-sm">تست زنده منشی</div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">پس از ذخیره تغییرات، می‌توانید منشی را همین‌جا امتحان کنید.</p>
            <div className="h-[460px]">
              <FloatingWidget tenantId={tenantId} variant="panel" initialOpen />
            </div>
          </CardContent>
        </Card>

        <SectionCard title="خلاصه پیکربندی">
          <div className="space-y-2 text-sm">
            <SumRow label="نام منشی" value={form.name} />
            <SumRow label="مدل" value={MODELS.find((m) => m.value === form.model)?.label || form.model} />
            <SumRow label="دمای پاسخگویی" value={toFa(form.temperature.toFixed(2))} />
            <SumRow label="آستانه اطمینان" value={`${toFa(Math.round(form.confidenceThreshold * 100))}٪`} />
            <SumRow
              label="کانال‌ها"
              value={
                <div className="flex flex-wrap gap-1 justify-end">
                  {form.channels.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{CHANNELS.find((x) => x.value === c)?.label || c}</Badge>
                  ))}
                </div>
              }
            />
            <SumRow label="صوتی" value={<Badge variant="outline" className="text-[10px]">{form.voiceEnabled ? "روشن" : "خاموش"}</Badge>} />
            <SumRow label="انتقال به اپراتور" value={<Badge variant="outline" className="text-[10px]">{form.humanHandoff ? "روشن" : "خاموش"}</Badge>} />
            <SumRow label="حلقه رشد" value={<Badge variant="outline" className="text-[10px]">{form.growthLoop ? "روشن" : "خاموش"}</Badge>} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, title, description, checked, onChange }: { icon: any; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border">
      <div className="grid place-items-center size-8 rounded-lg bg-muted text-muted-foreground shrink-0">
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-xs text-left">{value}</span>
    </div>
  );
}
