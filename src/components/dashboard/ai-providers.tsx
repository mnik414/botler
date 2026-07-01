"use client";
import * as React from "react";
import { useAsync, SectionCard, LoadingBlock, ErrorBlock, EmptyState } from "./shared";
import { api } from "@/lib/api-client";
import { toFa, formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot, CheckCircle2, Cpu, Sparkles, Lock, ShieldCheck, XCircle, Info,
} from "lucide-react";

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

const TYPE_LABELS: Record<string, string> = {
  zai: "پلتفرم پیش‌فرض", openai: "OpenAI", openrouter: "OpenRouter", anthropic: "Anthropic", gemini: "Google Gemini", custom: "سفارشی",
};
const TYPE_COLORS: Record<string, string> = {
  zai: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  openai: "bg-teal-500/15 text-teal-600 border-teal-500/30",
  openrouter: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  anthropic: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  gemini: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  custom: "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

export function AiProvidersTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<{ providers: ProviderRow[]; activeProviderId: string | null }>(
    () => api(`/api/ai-providers?tenantId=${tenantId}`),
    [tenantId]
  );

  if (loading) return <LoadingBlock lines={3} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const { providers, activeProviderId } = data;
  const active = providers.find((p) => p.id === activeProviderId);

  return (
    <div className="space-y-5">
      {/* Permission notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <div className="grid place-items-center size-9 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
          <Lock className="size-4" />
        </div>
        <div className="text-xs leading-6 text-muted-foreground">
          <strong className="text-foreground">مدیریت توسط مدیر سیستم:</strong> اتصال، تغییر یا حذف مدل و API هوش مصنوعی
          تنها توسط <strong className="text-foreground">مدیر سیستم</strong> قابل انجام است. شما می‌توانید موتور فعال
          کسب‌وکار خود را مشاهده کنید. برای تغییر، با مدیر پلتفرم تماس بگیرید.
        </div>
      </div>

      {/* Active provider status */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`grid place-items-center size-11 rounded-xl ${activeProviderId ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              <Cpu className="size-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">موتور فعال فعلی</div>
              {active ? (
                <>
                  <div className="font-bold">{active.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_LABELS[active.type] || active.type} · {active.model}
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
          {active && (
            <Badge className="gap-0.5"><ShieldCheck className="size-3" /> فعال توسط مدیر سیستم</Badge>
          )}
        </div>
      </Card>

      {/* Providers list (read-only) */}
      <SectionCard title="ارائه‌دهنده‌های پیکربندی‌شده" description={`مجموع ${toFa(providers.length)} ارائه‌دهنده`}>
        {providers.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="هنوز ارائه‌دهنده‌ای پیکربندی نشده"
            description="مدیر سیستم می‌تواند مدل‌های هوش مصنوعی اختصاصی (مثل GPT-4o یا Claude) را برای کسب‌وکار شما پیکربندی کند."
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
                  <Lock className="size-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
        <Info className="size-3.5 shrink-0 mt-0.5" />
        <span>برای درخواست اتصال مدل/API اختصاصی (OpenAI، Anthropic، Gemini یا endpoint سفارشی)، با مدیر پلتفرم تماس بگیرید.</span>
      </div>
    </div>
  );
}
