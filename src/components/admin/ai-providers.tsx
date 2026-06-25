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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Bot, Plus, Trash2, CheckCircle2, XCircle, Loader2, Zap, Key, Globe, Cpu, Power, Lock, Building2,
  Layers, CheckSquare, Square, AlertCircle, Info,
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
  id: string; tenantId: string; name: string; type: string; baseUrl: string; model: string;
  isActive: boolean; lastTestedAt: string | null; lastTestOk: boolean | null; createdAt: string;
}
interface ProviderTypeMeta { code: string; label: string; desc: string; defaultModel: string; needsBaseUrl: boolean; needsKey: boolean; }
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

// Local fallback so provider type list is always available (even in bulk mode where no tenant is selected)
const FALLBACK_PROVIDER_TYPES: ProviderTypeMeta[] = [
  { code: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4o-mini, GPT-4 Turbo و سایر مدل‌های OpenAI", defaultModel: "gpt-4o-mini", needsBaseUrl: false, needsKey: true },
  { code: "anthropic", label: "Anthropic (Claude)", desc: "Claude 3.5 Sonnet, Haiku, Opus", defaultModel: "claude-3-5-sonnet-20241022", needsBaseUrl: false, needsKey: true },
  { code: "gemini", label: "Google Gemini", desc: "Gemini 1.5 Pro / Flash", defaultModel: "gemini-1.5-flash", needsBaseUrl: false, needsKey: true },
  { code: "custom", label: "سازگار با OpenAI (سفارشی)", desc: "هر endpoint سازگار با OpenAI: Azure، OpenRouter، vLLM، Ollama، LM Studio", defaultModel: "llama3.1", needsBaseUrl: true, needsKey: true },
  { code: "zai", label: "پلتفرم پیش‌فرض (Z.ai)", desc: "استفاده از موتور پیش‌فرض پلتفرم بدون نیاز به کلید API", defaultModel: "glm-4.6", needsBaseUrl: false, needsKey: false },
];

export function AdminAiProviders() {
  const tenantsReq = useAsync<TenantRow[]>(() => api("/api/tenants"), []);
  const [selectedTenant, setSelectedTenant] = React.useState<string>("");
  const [selectedTenants, setSelectedTenants] = React.useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = React.useState(false);
  const [singleDialogOpen, setSingleDialogOpen] = React.useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [activatingId, setActivatingId] = React.useState<string | null>(null);

  // Auto-select first tenant
  React.useEffect(() => {
    if (!selectedTenant && tenantsReq.data && tenantsReq.data.length > 0) {
      setSelectedTenant(tenantsReq.data[0].id);
    }
  }, [tenantsReq.data, selectedTenant]);

  // Load providers for the single selected tenant
  const providersReq = useAsync<{ providers: ProviderRow[]; activeProviderId: string | null; providerTypes: ProviderTypeMeta[] }>(
    () => selectedTenant && !bulkMode
      ? api(`/api/ai-providers?tenantId=${selectedTenant}`)
      : Promise.resolve({ providers: [], activeProviderId: null, providerTypes: [] }),
    [selectedTenant, bulkMode]
  );

  const tenants = tenantsReq.data || [];
  const providers = providersReq.data?.providers || [];
  const activeProviderId = providersReq.data?.activeProviderId || null;
  const providerTypes = providersReq.data?.providerTypes?.length ? providersReq.data.providerTypes : FALLBACK_PROVIDER_TYPES;
  const selectedTenantObj = tenants.find((t) => t.id === selectedTenant);

  const toggleTenant = (id: string) => {
    setSelectedTenants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllTenants = () => setSelectedTenants(new Set(tenants.map((t) => t.id)));
  const clearSelection = () => setSelectedTenants(new Set());

  // Single-tenant operations
  const testProviderSingle = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST", body: JSON.stringify({ tenantId: selectedTenant, providerId: id }),
      });
      if (res.ok) toast.success(`اتصال موفق! ${res.reply.slice(0, 50)}`);
      else toast.error(`ناموفق: ${res.error}`);
      providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setTestingId(null); }
  };

  const activateSingle = async (id: string) => {
    setActivatingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${selectedTenant}`, { method: "PATCH", body: JSON.stringify({ activate: true }) });
      toast.success("فعال شد."); providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setActivatingId(null); }
  };

  const deactivateSingle = async (id: string) => {
    setActivatingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${selectedTenant}`, { method: "PATCH", body: JSON.stringify({ deactivate: true }) });
      toast.success("به پیش‌فرض بازگشت."); providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setActivatingId(null); }
  };

  const removeSingle = async (id: string) => {
    setDeletingId(id);
    try {
      await api(`/api/ai-providers/${id}?tenantId=${selectedTenant}`, { method: "DELETE" });
      toast.success("حذف شد."); providersReq.reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setDeletingId(null); }
  };

  if (tenantsReq.loading) return <div className="space-y-4"><CardSkeletons count={3} /><Card className="p-5"><Skeleton className="h-40 w-full" /></Card></div>;
  if (tenantsReq.error || !tenantsReq.data) return <ErrorState message={tenantsReq.error || "خطا"} onReload={tenantsReq.reload} />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionCard title="مدیریت موتور هوش مصنوعی" description="پیکربندی مدل/API اختصاصی برای کسب‌وکارها (فقط مدیر سیستم)">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <Lock className="size-4" />
          </div>
          <div className="text-xs leading-6 text-muted-foreground">
            شما می‌توانید یک کسب‌وکار را انتخاب کنید تا ارائه‌دهنده‌های آن را ببینید و مدیریت کنید، یا با
            <strong className="text-foreground"> حالت چندتایی</strong> چند کسب‌وکار (یا همه) را انتخاب کرده و یک ارائه‌دهنده را
            یک‌باره برای همه آن‌ها ایجاد/فعال‌سازی/غیرفعال‌سازی/حذف کنید.
          </div>
        </div>
      </SectionCard>

      {/* Mode toggle + tenant selection */}
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          {/* Mode switch */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={bulkMode ? "outline" : "secondary"} size="sm" className="gap-1.5" onClick={() => { setBulkMode(false); clearSelection(); }}>
              <Building2 className="size-3.5" /> تک کسب‌وکار
            </Button>
            <Button variant={bulkMode ? "secondary" : "outline"} size="sm" className="gap-1.5" onClick={() => { setBulkMode(true); setSelectedTenant(""); }}>
              <Layers className="size-3.5" /> چند کسب‌وکار (دسته‌جمعی)
            </Button>
          </div>

          {!bulkMode ? (
            /* Single-tenant selector */
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium shrink-0">کسب‌وکار:</span>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="انتخاب کنید" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono mr-2">{t.slug}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTenantObj && <Badge variant="outline" className="text-xs">{toFa(providers.length)} ارائه‌دهنده</Badge>}
            </div>
          ) : (
            /* Multi-tenant selection */
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {toFa(selectedTenants.size)} کسب‌وکار انتخاب‌شده
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={selectAllTenants}>
                    <CheckSquare className="size-3.5" /> انتخاب همه ({toFa(tenants.length)})
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearSelection} disabled={selectedTenants.size === 0}>
                    <Square className="size-3.5" /> پاک کردن
                  </Button>
                </div>
              </div>
              {/* Tenant checkboxes */}
              <div className="border rounded-lg max-h-48 overflow-y-auto scroll-area divide-y">
                {tenants.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 p-2.5 hover:bg-accent/40 cursor-pointer">
                    <Checkbox checked={selectedTenants.has(t.id)} onCheckedChange={() => toggleTenant(t.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{t.slug}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Single-tenant view */}
      {!bulkMode && (
        <>
          {!selectedTenant ? (
            <InlineEmptyState icon={Building2} title="یک کسب‌وکار انتخاب کنید" description="برای مدیریت موتور هوش مصنوعی، یک کسب‌وکار را انتخاب کنید." />
          ) : providersReq.loading ? (
            <Card className="p-5"><Skeleton className="h-40 w-full" /></Card>
          ) : (
            <>
              {/* Active provider */}
              <Card className="p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`grid place-items-center size-11 rounded-xl ${activeProviderId ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      <Cpu className="size-5" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">موتور فعال {selectedTenantObj?.name}</div>
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
                          <div className="text-xs text-muted-foreground">glm-4.6</div>
                        </>
                      )}
                    </div>
                  </div>
                  {activeProviderId && (
                    <Button variant="outline" size="sm" onClick={() => deactivateSingle(activeProviderId)} disabled={activatingId === activeProviderId} className="gap-1.5">
                      {activatingId === activeProviderId ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                      بازگشت به پیش‌فرض
                    </Button>
                  )}
                </div>
              </Card>

              {/* Providers list */}
              <SectionCard
                title="ارائه‌دهنده‌های پیکربندی‌شده"
                description={`مجموع ${toFa(providers.length)} ارائه‌دهنده برای ${selectedTenantObj?.name}`}
                action={
                  <Dialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen}>
                    <Button size="sm" className="gap-1.5" onClick={() => setSingleDialogOpen(true)}>
                      <Plus className="size-4" /> افزودن
                    </Button>
                    <ProviderFormDialog
                      open={singleDialogOpen} onOpenChange={setSingleDialogOpen}
                      providerTypes={providerTypes}
                      title={`افزودن موتور برای ${selectedTenantObj?.name}`}
                      onSubmit={async (data) => {
                        await api("/api/ai-providers", { method: "POST", body: JSON.stringify({ tenantId: selectedTenant, ...data }) });
                        toast.success("افزوده شد."); setSingleDialogOpen(false); providersReq.reload();
                      }}
                    />
                  </Dialog>
                }
              >
                {providers.length === 0 ? (
                  <InlineEmptyState icon={Bot} title="هنوز ارائه‌دهنده‌ای نیست" description="اولین موتور هوش مصنوعی را اضافه کنید." />
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
                              {p.lastTestedAt && <span>· {formatDate(p.lastTestedAt)}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="outline" size="sm" className="gap-1.5" disabled={testingId === p.id} onClick={() => testProviderSingle(p.id)}>
                              {testingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                              <span className="hidden sm:inline">تست</span>
                            </Button>
                            {!isActive && (
                              <Button size="sm" className="gap-1.5" disabled={activatingId === p.id} onClick={() => activateSingle(p.id)}>
                                {activatingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                                <span className="hidden sm:inline">فعال</span>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" disabled={deletingId === p.id} onClick={() => removeSingle(p.id)}>
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
        </>
      )}

      {/* Bulk view */}
      {bulkMode && (
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="grid place-items-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
              <Layers className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">عملیات دسته‌جمعی</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                یک ارائه‌دهنده را یک‌باره برای {toFa(selectedTenants.size)} کسب‌وکار انتخاب‌شده ایجاد، فعال‌سازی، غیرفعال‌سازی یا حذف کنید.
              </p>
            </div>
          </div>

          {selectedTenants.size === 0 ? (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <AlertCircle className="size-4 shrink-0" />
              ابتدا حداقل یک کسب‌وکار را از لیست بالا انتخاب کنید.
            </div>
          ) : (
            <>
              <BulkActions
                tenantIds={[...selectedTenants]}
                tenants={tenants}
                providerTypes={providerTypes}
                onDone={() => { /* bulk ops don't need per-tenant reload */ }}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Bulk actions component — create / activate / deactivate / delete for multiple tenants
// ────────────────────────────────────────────────────────────
function BulkActions({ tenantIds, tenants, providerTypes, onDone }: { tenantIds: string[]; tenants: TenantRow[]; providerTypes: ProviderTypeMeta[]; onDone: () => void }) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [activateOpen, setActivateOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const runBulk = async (action: string, extra: any = {}) => {
    setBusy(action);
    try {
      const res = await api<{ successCount: number; failCount: number; results: any[] }>("/api/ai-providers/bulk", {
        method: "POST",
        body: JSON.stringify({ action, tenantIds, ...extra }),
      });
      if (res.failCount === 0) {
        toast.success(`عملیات با موفقیت برای ${toFa(res.successCount)} کسب‌وکار انجام شد.`);
      } else {
        // Show which tenants failed
        const failed = res.results.filter((r: any) => !r.ok).map((r: any) => {
          const t = tenants.find((x) => x.id === r.tenantId);
          return t?.name || r.tenantId.slice(0, 8);
        });
        toast.warning(`${toFa(res.successCount)} موفق، ${toFa(res.failCount)} ناموفق: ${failed.join("، ")}`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action cards */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Create */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="size-4 text-primary" />
            <h4 className="font-medium text-sm">ایجاد و اعمال ارائه‌دهنده</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-5">
            یک ارائه‌دهنده جدید (با کلید و مدل یکسان) برای همه {toFa(tenantIds.length)} کسب‌وکار ایجاد کنید و اختیاریاً بلافاصله فعال کنید.
          </p>
          <Button className="w-full gap-1.5" onClick={() => setCreateOpen(true)} disabled={!!busy}>
            <Plus className="size-4" /> ایجاد دسته‌جمعی
          </Button>
        </Card>

        {/* Deactivate all */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Power className="size-4 text-amber-600" />
            <h4 className="font-medium text-sm">غیرفعال‌سازی همه</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-5">
            همه {toFa(tenantIds.length)} کسب‌وکار را به موتور پیش‌فرض پلتفرم (Z.ai) بازگردانید.
          </p>
          <Button variant="outline" className="w-full gap-1.5" onClick={() => runBulk("deactivate")} disabled={!!busy}>
            {busy === "deactivate" ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
            بازگشت همه به پیش‌فرض
          </Button>
        </Card>

        {/* Activate existing */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <h4 className="font-medium text-sm">فعال‌سازی ارائه‌دهنده موجود</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-5">
            یک ارائه‌دهنده از پیش موجود (با نام و نوع مشخص) را برای همه {toFa(tenantIds.length)} کسب‌وکار فعال کنید.
          </p>
          <Button variant="outline" className="w-full gap-1.5" onClick={() => setActivateOpen(true)} disabled={!!busy}>
            <CheckCircle2 className="size-4" /> فعال‌سازی دسته‌جمعی
          </Button>
        </Card>

        {/* Delete */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trash2 className="size-4 text-rose-600" />
            <h4 className="font-medium text-sm">حذف ارائه‌دهنده</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-5">
            یک ارائه‌دهنده (با نام و نوع مشخص) را از همه {toFa(tenantIds.length)} کسب‌وکار حذف کنید.
          </p>
          <Button variant="outline" className="w-full gap-1.5 text-rose-600 hover:text-rose-700" onClick={() => setDeleteOpen(true)} disabled={!!busy}>
            <Trash2 className="size-4" /> حذف دسته‌جمعی
          </Button>
        </Card>
      </div>

      {/* Selected tenants summary */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">کسب‌وکارهای انتخاب‌شده ({toFa(tenantIds.length)})</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tenantIds.map((id) => {
            const t = tenants.find((x) => x.id === id);
            return (
              <Badge key={id} variant="secondary" className="text-[10px] gap-1">
                {t?.name || id.slice(0, 8)}
              </Badge>
            );
          })}
        </div>
      </Card>

      {/* Create dialog */}
      <BulkCreateDialog
        open={createOpen} onOpenChange={setCreateOpen}
        providerTypes={providerTypes}
        tenantCount={tenantIds.length}
        onSubmit={async (data) => {
          await runBulk("create", data);
          setCreateOpen(false);
        }}
      />

      {/* Activate existing dialog */}
      <BulkNameTypeDialog
        open={activateOpen} onOpenChange={setActivateOpen}
        title="فعال‌سازی ارائه‌دهنده موجود"
        description={`یک ارائه‌دهنده از پیش موجود را با نام و نوع آن برای ${toFa(tenantIds.length)} کسب‌وکار فعال کنید.`}
        providerTypes={providerTypes}
        submitLabel="فعال‌سازی برای همه"
        icon={<CheckCircle2 className="size-4" />}
        onSubmit={async (data) => {
          await runBulk("activate", data);
          setActivateOpen(false);
        }}
      />

      {/* Delete dialog */}
      <BulkNameTypeDialog
        open={deleteOpen} onOpenChange={setDeleteOpen}
        title="حذف ارائه‌دهنده"
        description={`یک ارائه‌دهنده را با نام و نوع آن از ${toFa(tenantIds.length)} کسب‌وکار حذف کنید. این عملیات قابل بازگشت نیست.`}
        providerTypes={providerTypes}
        submitLabel="حذف از همه"
        icon={<Trash2 className="size-4" />}
        danger
        onSubmit={async (data) => {
          await runBulk("delete", data);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Bulk Create Dialog — rich form with all fields + activate-after-create + custom base URL toggle
// ────────────────────────────────────────────────────────────
function BulkCreateDialog({
  open, onOpenChange, providerTypes, tenantCount, onSubmit,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  providerTypes: ProviderTypeMeta[]; tenantCount: number;
  onSubmit: (data: { name: string; type: string; apiKey: string; baseUrl: string; model: string; activateAfterCreate: boolean }) => Promise<void>;
}) {
  const [type, setType] = React.useState("openai");
  const [name, setName] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [activateAfterCreate, setActivateAfterCreate] = React.useState(true);
  const [useCustomBaseUrl, setUseCustomBaseUrl] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; reply?: string; error?: string } | null>(null);

  const pt = providerTypes.find((p) => p.code === type);

  // Show base URL field if the type inherently needs it OR the admin toggled custom URL
  const showBaseUrl = !!pt?.needsBaseUrl || useCustomBaseUrl;
  const showApiKey = !!pt?.needsKey;

  React.useEffect(() => {
    if (pt) {
      setModel(pt.defaultModel);
      if (!name) setName(pt.label);
    }
  }, [type]);

  React.useEffect(() => {
    // Clear test result when fields change
    setTestResult(null);
  }, [type, apiKey, baseUrl, model]);

  const reset = () => {
    setType("openai"); setName(""); setApiKey(""); setBaseUrl(""); setModel("");
    setActivateAfterCreate(true); setUseCustomBaseUrl(false); setTestResult(null);
  };

  const validate = (): string | null => {
    if (!name.trim()) return "نام نمایشی الزامی است";
    if (!type) return "نوع ارائه‌دهنده الزامی است";
    if (showApiKey && !apiKey.trim()) return "کلید API الزامی است برای این نوع ارائه‌دهنده";
    if (showBaseUrl && !baseUrl.trim()) return "آدرس Base URL الزامی است";
    if (showBaseUrl && baseUrl.trim()) {
      try { new URL(baseUrl.trim()); } catch { return "آدرس Base URL معتبر نیست (باید با http:// یا https:// شروع شود)"; }
    }
    if (!model.trim() && !pt?.defaultModel) return "شناسه مدل الزامی است";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(), type,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim() || pt?.defaultModel || "",
        activateAfterCreate,
      });
      reset();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const testInline = async () => {
    const err = validate();
    if (err && err !== "نام نمایشی الزامی است") { toast.error(err); return; }
    if (showApiKey && !apiKey.trim()) { toast.error("ابتدا کلید API را وارد کنید"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST",
        body: JSON.stringify({
          type,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          model: model.trim() || pt?.defaultModel,
        }),
      });
      setTestResult(res);
      if (res.ok) toast.success(`اتصال موفق! پاسخ نمونه: ${res.reply.slice(0, 50)}`);
      else toast.error(`اتصال ناموفق: ${res.error || "نامشخص"}`);
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  const apiKeyPlaceholder: Record<string, string> = {
    openai: "sk-proj-...",
    anthropic: "sk-ant-...",
    gemini: "AIza...",
    custom: "کلید API شما",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Plus className="size-4" /> ایجاد و اعمال ارائه‌دهنده برای {toFa(tenantCount)} کسب‌وکار</DialogTitle>
        <DialogDescription>یک ارائه‌دهنده با تنظیمات یکسان برای همه کسب‌وکارهای انتخاب‌شده ایجاد می‌شود</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 max-h-[65vh] overflow-y-auto scroll-area pl-1">
        {/* Provider type */}
        <div className="space-y-1.5">
          <Label>نوع ارائه‌دهنده <span className="text-destructive">*</span></Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providerTypes.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {pt && <p className="text-xs text-muted-foreground leading-5 flex items-start gap-1.5"><Info className="size-3 shrink-0 mt-0.5" />{pt.desc}</p>}
        </div>

        {/* Display name */}
        <div className="space-y-1.5">
          <Label>نام نمایشی <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: OpenAI تولیدی، Claude پشتیبانی" />
          <p className="text-[10px] text-muted-foreground">این نام در لیست ارائه‌دهنده‌های هر کسب‌وکار نمایش داده می‌شود</p>
        </div>

        {/* API key */}
        {showApiKey && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Key className="size-3" /> کلید API <span className="text-destructive">*</span></Label>
            <Input
              value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              type="password" dir="ltr"
              placeholder={apiKeyPlaceholder[type] || "کلید API"}
              className="font-mono text-left"
            />
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Lock className="size-2.5" /> کلید به‌صورت امن ذخیره می‌شود و فقط برای منشی همین کسب‌وکار استفاده می‌شود
            </p>
          </div>
        )}

        {/* Custom base URL toggle (for openai/anthropic/gemini that don't strictly need it) */}
        {!pt?.needsBaseUrl && pt?.code !== "zai" && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">استفاده از Base URL سفارشی</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">برای Azure، OpenRouter، پروکسی یا endpoint محلی</p>
            </div>
            <Checkbox checked={useCustomBaseUrl} onCheckedChange={(v) => setUseCustomBaseUrl(!!v)} />
          </div>
        )}

        {/* Base URL */}
        {showBaseUrl && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Globe className="size-3" /> آدرس Base URL <span className="text-destructive">*</span></Label>
            <Input
              value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              dir="ltr" placeholder="https://api.openai.com/v1"
              className="font-mono text-left"
            />
            <p className="text-[10px] text-muted-foreground">
              {type === "custom" ? "آدرس کامل endpoint سازگار با OpenAI (مثلاً http://localhost:11434/v1 برای Ollama)" : "بدون /chat/completions در انتها — فقط پایه"}
            </p>
          </div>
        )}

        {/* Model */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Cpu className="size-3" /> شناسه مدل <span className="text-destructive">*</span></Label>
          <Input
            value={model} onChange={(e) => setModel(e.target.value)}
            dir="ltr" placeholder={pt?.defaultModel}
            className="font-mono text-left"
          />
          {pt && (
            <div className="text-[10px] text-muted-foreground">
              <span className="font-medium">پیشنهاد:</span> {pt.defaultModel}
              {type === "openai" && " (گزینه‌ها: gpt-4o, gpt-4o-mini, gpt-4-turbo)"}
              {type === "anthropic" && " (گزینه‌ها: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022)"}
              {type === "gemini" && " (گزینه‌ها: gemini-1.5-pro, gemini-1.5-flash)"}
            </div>
          )}
        </div>

        {/* Activate after create */}
        <div className="flex items-center justify-between rounded-lg border p-3 bg-primary/5 border-primary/20">
          <div>
            <Label className="cursor-pointer">فعال‌سازی بلافاصله پس از ایجاد</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">اگر فعال باشد، این ارائه‌دهنده به‌محض ایجاد برای هر کسب‌وکار به‌عنوان موتور فعال تنظیم می‌شود</p>
          </div>
          <Checkbox checked={activateAfterCreate} onCheckedChange={(v) => setActivateAfterCreate(!!v)} />
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${testResult.ok ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" : "bg-rose-500/10 text-rose-700 border border-rose-500/30"}`}>
            {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
            <div>
              <div className="font-medium">{testResult.ok ? "اتصال موفق" : "اتصال ناموفق"}</div>
              {testResult.ok && testResult.reply && <div className="text-[10px] opacity-80">پاسخ نمونه: {testResult.reply}</div>}
              {!testResult.ok && testResult.error && <div className="text-[10px] opacity-80">{testResult.error}</div>}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={testInline} disabled={testing || submitting} className="gap-1.5">
          {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          تست اتصال
        </Button>
        <Button onClick={submit} disabled={submitting} className="gap-1.5">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          ایجاد و اعمال برای {toFa(tenantCount)} کسب‌وکار
        </Button>
      </DialogFooter>
    </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Bulk Name+Type Dialog (for activate/delete existing provider by name+type)
// ────────────────────────────────────────────────────────────
function BulkNameTypeDialog({
  open, onOpenChange, title, description, providerTypes, submitLabel, icon, danger, onSubmit,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  title: string; description: string; providerTypes: ProviderTypeMeta[];
  submitLabel: string; icon: React.ReactNode; danger?: boolean;
  onSubmit: (data: { name: string; type: string }) => Promise<void>;
}) {
  const [type, setType] = React.useState("openai");
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const pt = providerTypes.find((p) => p.code === type);

  const reset = () => { setType("openai"); setName(""); };

  const submit = async () => {
    if (!name.trim()) { toast.error("نام ارائه‌دهنده الزامی است"); return; }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), type });
      reset();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">{icon} {title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>نوع ارائه‌دهنده</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providerTypes.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>نام نمایشی ارائه‌دهنده</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: OpenAI تولیدی" />
          <p className="text-[10px] text-muted-foreground">دقیقاً همان نامی که هنگام ایجاد وارد کرده بودید</p>
        </div>
        {pt && (
          <div className="text-[10px] text-muted-foreground bg-muted/40 rounded p-2 flex items-start gap-1.5">
            <Info className="size-3 shrink-0 mt-0.5" />
            عملیات فقط روی ارائه‌دهنده‌ای با این نام و نوع اعمال می‌شود. اگر در کسب‌وکاری وجود نداشته باشد، آن کسب‌وکار نادیده گرفته می‌شود.
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
        <Button onClick={submit} disabled={submitting} variant={danger ? "destructive" : "default"} className="gap-1.5">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : icon}
          {submitLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
// Reusable provider form dialog (used for single-tenant create only)
// ────────────────────────────────────────────────────────────
function ProviderFormDialog({
  open, onOpenChange, providerTypes, title, onSubmit, submitLabel,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  providerTypes: ProviderTypeMeta[]; title: string;
  onSubmit: (data: { name: string; type: string; apiKey: string; baseUrl: string; model: string }) => Promise<void>;
  submitLabel?: string;
}) {
  const [type, setType] = React.useState("openai");
  const [name, setName] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [model, setModel] = React.useState("");
  const [useCustomBaseUrl, setUseCustomBaseUrl] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const pt = providerTypes.find((p) => p.code === type);
  const showBaseUrl = !!pt?.needsBaseUrl || useCustomBaseUrl;
  const showApiKey = !!pt?.needsKey;

  React.useEffect(() => {
    if (pt) { if (!model) setModel(pt.defaultModel); if (!name) setName(pt.label); }
  }, [type]);

  const reset = () => { setType("openai"); setName(""); setApiKey(""); setBaseUrl(""); setModel(""); setUseCustomBaseUrl(false); };

  const submit = async () => {
    if (!name.trim()) { toast.error("نام الزامی است"); return; }
    if (showApiKey && !apiKey.trim()) { toast.error("کلید API الزامی است"); return; }
    if (showBaseUrl && !baseUrl.trim()) { toast.error("Base URL الزامی است"); return; }
    if (showBaseUrl && baseUrl.trim()) {
      try { new URL(baseUrl.trim()); } catch { toast.error("آدرس Base URL معتبر نیست"); return; }
    }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), type, apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() || pt?.defaultModel || "" });
      reset();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const testInline = async () => {
    if (showApiKey && !apiKey.trim()) { toast.error("ابتدا کلید API را وارد کنید"); return; }
    setTesting(true);
    try {
      const res = await api<{ ok: boolean; reply: string; error?: string }>("/api/ai-providers/test", {
        method: "POST", body: JSON.stringify({ type, apiKey, baseUrl, model: model || pt?.defaultModel }),
      });
      if (res.ok) toast.success(`موفق! ${res.reply.slice(0, 50)}`);
      else toast.error(`ناموفق: ${res.error}`);
    } catch (e: any) { toast.error(e.message); }
    finally { setTesting(false); }
  };

  const apiKeyPlaceholder: Record<string, string> = {
    openai: "sk-proj-...", anthropic: "sk-ant-...", gemini: "AIza...", custom: "کلید API شما",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Plus className="size-4" /> {title}</DialogTitle>
        <DialogDescription>پیکربندی مدل یا API اختصاصی</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-area pl-1">
        <div className="space-y-1.5">
          <Label>نوع ارائه‌دهنده <span className="text-destructive">*</span></Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {providerTypes.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {pt && <p className="text-xs text-muted-foreground leading-5 flex items-start gap-1.5"><Info className="size-3 shrink-0 mt-0.5" />{pt.desc}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>نام (نمایشی) <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: OpenAI تولیدی" />
        </div>
        {showApiKey && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Key className="size-3" /> کلید API <span className="text-destructive">*</span></Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" dir="ltr" placeholder={apiKeyPlaceholder[type] || "sk-..."} className="font-mono text-left" />
          </div>
        )}
        {!pt?.needsBaseUrl && pt?.code !== "zai" && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">استفاده از Base URL سفارشی</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">برای Azure، OpenRouter یا endpoint محلی</p>
            </div>
            <Checkbox checked={useCustomBaseUrl} onCheckedChange={(v) => setUseCustomBaseUrl(!!v)} />
          </div>
        )}
        {showBaseUrl && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Globe className="size-3" /> Base URL <span className="text-destructive">*</span></Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} dir="ltr" placeholder="https://api.openai.com/v1" className="font-mono text-left" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Cpu className="size-3" /> شناسه مدل <span className="text-destructive">*</span></Label>
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
          {submitLabel || "افزودن"}
        </Button>
      </DialogFooter>
    </DialogContent>
    </Dialog>
  );
}
