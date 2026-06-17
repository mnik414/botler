"use client";
import * as React from "react";
import { useAsync, SectionCard, CardSkeletons, ErrorState } from "./shared";
import { api } from "@/lib/api-client";
import { toFa, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
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
  Bot, Plus, Trash2, CheckCircle2, XCircle, Loader2, Zap, Key, Globe, Cpu, Power, Lock, Building2,
} from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

function InlineEmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="grid place-items-center size-12 rounded-xl bg-muted text-muted-foreground mb-3">
        <Icon className="size-6" />
      </div>
      <div className="font-medium text-sm mb-1">{title}</div>
      <div className="text-xs text-muted-foreground max-w-xs">{description}</div>
    </div>
  );
}

interface ProviderRow {
  id: string;
  tenantId: string;
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
interface TenantRow { id: string; name: string; slug: string; businessType: string; }

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

export function AdminAiProviders() {
  const [tenantId, setTenantId] = React.useState<string>("");
  const tenantsReq = useAsync<TenantRow[]>(() => api("/api/tenants"), []);
  const providersReq = useAsync<{ providers: ProviderRow[]; activeProviderId: string | null; providerTypes: ProviderTypeMeta[] }>(
    () => tenantId ? api(`/api/ai-providers?tenantId=${tenantId}`) : Promise.resolve({ providers: [], activeProviderId: null, providerTypes: [] }),
    [tenantId]
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);

  // Auto-select first tenant
  React.useEffect(() => {
    if (!tenantId && tenantsReq.data && tenantsReq.data.length > 0) {
      setTenantId(tenantsReq.data[0].id);
    }
  }, [tenantsReq.data, tenantId]);

  const testProvider = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST", body: JSON.stringify({ tenantId, providerId: id }),
      });
      if (res.ok) toast.success(`اتصال موفق! پاسخ نمونه: ${res.reply.slice(0, 60)}`);
      else toast.error(`اتصال ناموفق: ${res.error || "نامشخص"}`);
      providersReq.reload();
    } catch (e: any) { toast.error(e.message || "خطا"); }
    finally { setTestingId(null); }
  };

  const activate = async (id: string) => {
    setActivatingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${tenantId}`, { method: "PATCH", body: JSON.stringify({ activate: true }) });
      toast.success("ارائه‌دهنده فعال شد.");
      providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setActivatingId(null); }
  };

  const deactivate = async (id: string) => {
    setActivatingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${tenantId}`, { method: "PATCH", body: JSON.stringify({ deactivate: true }) });
      toast.success("به موتور پیش‌فرض بازگشت.");
      providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setActivatingId(null); }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${tenantId}`, { method: "DELETE" });
      toast.success("ارائه‌دهنده حذف شد.");
      providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingId(null); }
  };

  if (tenantsReq.loading) return <div className="space-y-4"><CardSkeletons count={3} /><Card className="p-5"><Skeleton className="h-40 w-full" /></Card></div>;
  if (tenantsReq.error || !tenantsReq.data) return <ErrorState message={tenantsReq.error || undefined} onReload={tenantsReq.reload} />;

  const tenants = tenantsReq.data;
  const selectedTenant = tenants.find((t) => t.id === tenantId);
  const { providers, activeProviderId, providerTypes } = providersReq.data || { providers: [], activeProviderId: null, providerTypes: [] };

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionCard title="مدیریت موتور هوش مصنوعی" description="پیکربندی مدل/API اختصاصی برای هر کسب‌وکار (فقط مدیر سیستم)">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <Lock className="size-4" />
          </div>
          <div className="text-xs leading-6 text-muted-foreground">
            شما به‌عنوان <strong className="text-foreground">مدیر سیستم</strong> می‌توانید برای هر کسب‌وکار، موتور هوش مصنوعی
            اختصاصی (OpenAI، Anthropic، Gemini یا endpoint سفارشی) پیکربندی، تست و فعال کنید. کلیدهای API امن ذخیره می‌شوند.
          </div>
        </div>
      </SectionCard>

      {/* Tenant selector */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">کسب‌وکار:</span>
          </div>
          <Select value={tenantId} onValueChange={(v) => { setTenantId(v); }}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="یک کسب‌وکار انتخاب کنید" /></SelectTrigger>
            <SelectContent>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground font-mono mr-2">{t.slug}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTenant && (
            <Badge variant="outline" className="text-xs">{toFa(providers.length)} ارائه‌دهنده</Badge>
          )}
        </div>
      </Card>

      {!tenantId ? (
        <InlineEmptyState icon={Building2} title="یک کسب‌وکار انتخاب کنید" description="برای مدیریت موتور هوش مصنوعی، ابتدا یک کسب‌وکار را انتخاب کنید." />
      ) : providersReq.loading ? (
        <Card className="p-5"><Skeleton className="h-40 w-full" /></Card>
      ) : (
        <>
          {/* Active provider status */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`grid place-items-center size-11 rounded-xl ${activeProviderId ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  <Cpu className="size-5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">موتور فعال {selectedTenant?.name}</div>
                  {activeProviderId ? (
                    <>
                      <div className="font-bold">{providers.find((p) => p.id === activeProviderId)?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {TYPE_LABELS[providers.find((p) => p.id === activeProviderId)?.type || ""] || ""} · {providers.find((p) => p.id === activeProviderId)?.model}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-bold">پلتفرم پیش‌فرض (Z.ai)</div>
                      <div className="text-xs text-muted-foreground">glm-4.6 · بدون کلید API</div>
                    </>
                  )}
                </div>
              </div>
              {activeProviderId && (
                <Button variant="outline" size="sm" onClick={() => deactivate(activeProviderId)} disabled={activatingId === activeProviderId} className="gap-1.5">
                  {activatingId === activeProviderId ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                  بازگشت به پیش‌فرض
                </Button>
              )}
            </div>
          </Card>

          {/* Providers list with full management */}
          <SectionCard
            title="ارائه‌دهنده‌های پیکربندی‌شده"
            description={`مجموع ${toFa(providers.length)} ارائه‌دهنده برای ${selectedTenant?.name}`}
            action={
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" /> افزودن ارائه‌دهنده
                </Button>
                <AddProviderDialog
                  open={dialogOpen} onOpenChange={setDialogOpen}
                  providerTypes={providerTypes} tenantId={tenantId} tenantName={selectedTenant?.name || ""}
                  onSaved={() => { setDialogOpen(false); providersReq.reload(); }}
                />
              </Dialog>
            }
          >
            {providers.length === 0 ? (
              <InlineEmptyState icon={Bot} title="هنوز ارائه‌دهنده‌ای اضافه نشده" description="برای این کسب‌وکار، اولین موتور هوش مصنوعی اختصاصی را اضافه کنید." />
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
                          <span className="hidden sm:inline">تست</span>
                        </Button>
                        {!isActive ? (
                          <Button size="sm" className="gap-1.5" disabled={activatingId === p.id} onClick={() => activate(p.id)}>
                            {activatingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                            <span className="hidden sm:inline">فعال‌سازی</span>
                          </Button>
                        ) : null}
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
        </>
      )}
    </div>
  );
}

function AddProviderDialog({
  open, onOpenChange, providerTypes, tenantId, tenantName, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; providerTypes: ProviderTypeMeta[]; tenantId: string; tenantName: string; onSaved: () => void;
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
    if (pt) { if (!model) setModel(pt.defaultModel); if (!name) setName(pt.label); }
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
      toast.success(`ارائه‌دهنده برای ${tenantName} اضافه شد.`);
      reset(); onSaved();
    } catch (e: any) { toast.error(e.message || "خطا"); }
    finally { setSubmitting(false); }
  };

  const testInline = async () => {
    if (pt?.needsKey && !apiKey.trim()) { toast.error("ابتدا کلید API را وارد کنید"); return; }
    setTesting(true);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST", body: JSON.stringify({ type, apiKey, baseUrl, model: model || pt?.defaultModel }),
      });
      if (res.ok) toast.success(`اتصال موفق! پاسخ: ${res.reply.slice(0, 50)}`);
      else toast.error(`ناموفق: ${res.error}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  return (
    <DialogContent className="max-w-lg" open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Plus className="size-4" /> افزودن موتور هوش مصنوعی برای {tenantName}</DialogTitle>
        <DialogDescription>مدل یا API اختصاصی را برای این کسب‌وکار پیکربندی کنید</DialogDescription>
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
