"use client";
import * as React from "react";
import { useAsync, SectionCard, LoadingBlock, ErrorBlock, EmptyState, KpiCard } from "./shared";
import { api } from "@/lib/api-client";
import { toFa, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, Plus, Trash2, CheckCircle2, XCircle, Loader2, Zap, Key, Globe, Cpu, Sparkles, Power, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ProviderRow {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  createdAt: string;
}
interface ProviderTypeMeta {
  code: string; label: string; desc: string; defaultModel: string; needsBaseUrl: boolean; needsKey: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  zai: "پلتفرم پیش‌فرض", openai: "OpenAI", anthropic: "Anthropic", gemini: "Google Gemini", custom: "سفارشی",
};
const TYPE_COLORS: Record<string, string> = {
  zai: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  openai: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  anthropic: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  gemini: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  custom: "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

export function AiProvidersTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<{ providers: ProviderRow[]; activeProviderId: string | null; providerTypes: ProviderTypeMeta[] }>(
    () => api(`/api/ai-providers?tenantId=${tenantId}`),
    [tenantId]
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);

  const testProvider = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST",
        body: JSON.stringify({ tenantId, providerId: id }),
      });
      if (res.ok) toast.success(`اتصال موفق! پاسخ نمونه: ${res.reply.slice(0, 60)}`);
      else toast.error(`اتصال ناموفق: ${res.error || "نامشخص"}`);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا در تست");
    } finally {
      setTestingId(null);
    }
  };

  const activate = async (id: string) => {
    setActivatingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ activate: true }),
      });
      toast.success("این ارائه‌دهنده به‌عنوان موتور هوش مصنوعی منشی فعال شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setActivatingId(null);
    }
  };

  const deactivate = async () => {
    if (!data?.activeProviderId) return;
    setActivatingId(data.activeProviderId);
    try {
      await api(`/api/ai-providers/${data.activeProviderId}?tenantId=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ deactivate: true }),
      });
      toast.success("به موتور پیش‌فرض پلتفرم بازگشتید.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setActivatingId(null);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${tenantId}`, { method: "DELETE" });
      toast.success("ارائه‌دهنده حذف شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const { providers, activeProviderId, providerTypes } = data;

  return (
    <div className="space-y-5">
      {/* Header explainer */}
      <SectionCard title="اتصال هوش مصنوعی اختصاصی" description="مدل یا API هوش مصنوعی خودتان را متصل کنید">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <Sparkles className="size-4" />
          </div>
          <div className="text-xs leading-6 text-muted-foreground">
            شما می‌توانید از <strong className="text-foreground">موتور پیش‌فرض پلتفرم</strong> (بدون نیاز به کلید) استفاده کنید، یا
            <strong className="text-foreground"> API اختصاصی خودتان</strong> را متصل کنید: OpenAI، Anthropic (Claude)، Google Gemini،
            یا هر endpoint سازگار با OpenAI (مثل Azure، OpenRouter، vLLM، Ollama). کلید API شما امن ذخیره می‌شود و فقط برای منشی همین کسب‌وکار استفاده می‌شود.
          </div>
        </div>
      </SectionCard>

      {/* Active provider status */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`grid place-items-center size-11 rounded-xl ${activeProviderId ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">موتور فعال فعلی</div>
              {activeProviderId ? (
                <>
                  <div className="font-bold">{providers.find((p) => p.id === activeProviderId)?.name || "سفارشی"}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_LABELS[providers.find((p) => p.id === activeProviderId)?.type || ""] || ""} · {providers.find((p) => p.id === activeProviderId)?.model}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold">پلتفرم پیش‌فرض (Z.ai)</div>
                  <div className="text-xs text-muted-foreground">glm-4.6 · بدون نیاز به کلید API</div>
                </>
              )}
            </div>
          </div>
          {activeProviderId && (
            <Button variant="outline" size="sm" onClick={deactivate} disabled={activatingId === activeProviderId} className="gap-1.5">
              {activatingId === activeProviderId ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
              بازگشت به پیش‌فرض
            </Button>
          )}
        </div>
      </Card>

      {/* Providers list */}
      <SectionCard
        title="ارائه‌دهنده‌های پیکربندی‌شده"
        description={`مجموع ${toFa(providers.length)} ارائه‌دهنده`}
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> افزودن ارائه‌دهنده
            </Button>
            <AddProviderDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              providerTypes={providerTypes}
              tenantId={tenantId}
              onSaved={() => { setDialogOpen(false); reload(); }}
            />
          </Dialog>
        }
      >
        {providers.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="هنوز ارائه‌دهنده‌ای اضافه نشده"
            description="برای استفاده از مدل هوش مصنوعی اختصاصی (مثل GPT-4o یا Claude)، اولین ارائه‌دهنده خود را اضافه کنید."
          />
        ) : (
          <div className="space-y-3">
            {providers.map((p) => {
              const isActive = p.id === activeProviderId;
              return (
                <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isActive ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className={`grid place-items-center size-10 rounded-lg shrink-0 ${TYPE_COLORS[p.type] || "bg-muted"}`}>
                    <Bot className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[p.type]}`}>{TYPE_LABELS[p.type] || p.type}</Badge>
                      {isActive && <Badge className="text-[10px] gap-0.5"><CheckCircle2 className="size-2.5" /> فعال</Badge>}
                      {p.lastTestOk === true && <Badge variant="outline" className="text-[10px] gap-0.5 border-emerald-500/30 text-emerald-600"><CheckCircle2 className="size-2.5" /> تست موفق</Badge>}
                      {p.lastTestOk === false && <Badge variant="outline" className="text-[10px] gap-0.5 border-rose-500/30 text-rose-600"><XCircle className="size-2.5" /> تست ناموفق</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{p.model}</span>
                      {p.baseUrl && <span className="font-mono truncate max-w-[200px]" dir="ltr">{p.baseUrl}</span>}
                      {p.lastTestedAt && <span>· آخرین تست: {formatDate(p.lastTestedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={testingId === p.id} onClick={() => testProvider(p.id)}>
                      {testingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                      <span className="hidden sm:inline">تست اتصال</span>
                    </Button>
                    {!isActive && (
                      <Button size="sm" className="gap-1.5" disabled={activatingId === p.id} onClick={() => activate(p.id)}>
                        {activatingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                        <span className="hidden sm:inline">فعال‌سازی</span>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" disabled={deletingId === p.id} onClick={() => remove(p.id)}>
                      {deletingId === p.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function AddProviderDialog({
  open, onOpenChange, providerTypes, tenantId, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; providerTypes: ProviderTypeMeta[]; tenantId: string; onSaved: () => void;
}) {
  const [type, setType] = React.useState("openai");
  const [name, setName] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const pt = providerTypes.find((p) => p.code === type);

  React.useEffect(() => {
    if (pt) {
      if (!model) setModel(pt.defaultModel);
      if (!name) setName(pt.label);
    }
  }, [type]);

  const reset = () => { setType("openai"); setName(""); setApiKey(""); setBaseUrl(""); setModel(""); };

  const submit = async () => {
    if (!name.trim()) { toast.error("نام الزامی است"); return; }
    if (pt?.needsKey && !apiKey.trim()) { toast.error("کلید API الزامی است"); return; }
    if (pt?.needsBaseUrl && !baseUrl.trim()) { toast.error("Base URL الزامی است"); return; }
    setSubmitting(true);
    try {
      await api("/api/ai-providers", {
        method: "POST",
        body: JSON.stringify({ tenantId, name: name.trim(), type, apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() || pt?.defaultModel }),
      });
      toast.success("ارائه‌دهنده اضافه شد. می‌توانید آن را تست و فعال کنید.");
      reset();
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setSubmitting(false);
    }
  };

  const testInline = async () => {
    if (pt?.needsKey && !apiKey.trim()) { toast.error("ابتدا کلید API را وارد کنید"); return; }
    setTesting(true);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST",
        body: JSON.stringify({ type, apiKey, baseUrl, model: model || pt?.defaultModel }),
      });
      if (res.ok) toast.success(`اتصال موفق! پاسخ: ${res.reply.slice(0, 50)}`);
      else toast.error(`ناموفق: ${res.error}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <DialogContent className="max-w-lg" open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Plus className="size-4" /> افزودن ارائه‌دهنده هوش مصنوعی</DialogTitle>
        <DialogDescription>مدل یا API اختصاصی خود را متصل کنید</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-area pl-1">
        <div className="space-y-1.5">
          <Label>نوع ارائه‌دهنده</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providerTypes.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {pt && <p className="text-xs text-muted-foreground leading-5">{pt.desc}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>نام (نمایشی)</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: OpenAI تولیدی" />
        </div>
        {pt?.needsKey && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Key className="size-3" /> کلید API</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" dir="ltr" placeholder="sk-..." className="font-mono text-left" />
          </div>
        )}
        {pt?.needsBaseUrl && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Globe className="size-3" /> آدرس Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} dir="ltr" placeholder="https://your-endpoint/v1" className="font-mono text-left" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Cpu className="size-3" /> شناسه مدل</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} dir="ltr" placeholder={pt?.defaultModel} className="font-mono text-left" />
          {pt && <p className="text-[10px] text-muted-foreground">پیشنهاد: {pt.defaultModel}</p>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
          <AlertCircle className="size-3.5 shrink-0" />
          کلید API امن ذخیره می‌شود و فقط برای منشی همین کسب‌وکار استفاده می‌شود.
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={testInline} disabled={testing} className="gap-1.5">
          {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          تست اتصال
        </Button>
        <Button onClick={submit} disabled={submitting} className="gap-1.5">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          افزودن
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
