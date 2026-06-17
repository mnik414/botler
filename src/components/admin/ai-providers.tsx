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
  Layers, CheckSquare, Square, AlertCircle,
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
  const providerTypes = providersReq.data?.providerTypes || [];
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
  if (tenantsReq.error || !tenantsReq.data) return <ErrorState message={tenantsReq.error || undefined} onReload={tenantsReq.reload} />;

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
            <BulkActions
              tenantIds={[...selectedTenants]}
              providerTypes={providerTypes}
              onDone={() => { /* bulk ops don't need per-tenant reload */ }}
            />
          )}
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Bulk actions component
// ────────────────────────────────────────────────────────────
function BulkActions({ tenantIds, providerTypes, onDone }: { tenantIds: string[]; providerTypes: ProviderTypeMeta[]; onDone: () => void }) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const runBulk = async (action: string, extra: any = {}) => {
    setBusy(action);
    try {
      const res = await api<{ successCount: number; failCount: number }>("/api/ai-providers/bulk", {
        method: "POST",
        body: JSON.stringify({ action, tenantIds, ...extra }),
      });
      if (res.failCount === 0) {
        toast.success(`عملیات با موفقیت برای ${toFa(res.successCount)} کسب‌وکار انجام شد.`);
      } else {
        toast.warning(`${toFa(res.successCount)} موفق، ${toFa(res.failCount)} ناموفق.`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {/* Create provider for all */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="size-4 text-primary" />
            <h4 className="font-medium text-sm">ایجاد ارائه‌دهنده</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-5">
            یک ارائه‌دهنده جدید (با همان کلید و مدل) برای همه {toFa(tenantIds.length)} کسب‌وکار ایجاد کنید.
          </p>
          <Button className="w-full gap-1.5" onClick={() => setCreateOpen(true)} disabled={!!busy}>
            <Plus className="size-4" /> ایجاد دسته‌جمعی
          </Button>
        </Card>
        <ProviderFormDialog
          open={createOpen} onOpenChange={setCreateOpen}
          providerTypes={providerTypes}
          title={`ایجاد ارائه‌دهنده برای ${toFa(tenantIds.length)} کسب‌وکار`}
          submitLabel="ایجاد برای همه"
          onSubmit={async (data) => {
            await runBulk("create", data);
            setCreateOpen(false);
          }}
        />
      </Dialog>

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
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Reusable provider form dialog (used for single + bulk create)
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
      await onSubmit({ name: name.trim(), type, apiKey: apiKey.trim(), baseUrl: baseUrl.trim(), model: model.trim() || pt?.defaultModel || "" });
      reset();
    } catch (e: any) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  const testInline = async () => {
    if (pt?.needsKey && !apiKey.trim()) { toast.error("ابتدا کلید API را وارد کنید"); return; }
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

  return (
    <DialogContent className="max-w-lg" open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Plus className="size-4" /> {title}</DialogTitle>
        <DialogDescription>پیکربندی مدل یا API اختصاصی</DialogDescription>
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
            <Label className="flex items-center gap-1.5"><Globe className="size-3" /> Base URL</Label>
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
          {submitLabel || "افزودن"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
