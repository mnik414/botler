"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { api, type MarketplaceItem } from "@/lib/api-client";
import { FloatingWidget } from "@/components/widget/chat-widget";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Code2, Copy, Check, Store } from "lucide-react";
import { toast } from "sonner";
import { toFa } from "@/lib/format";

export function WidgetDemoPage() {
  const { setActiveTenant, activeTenantId } = useApp();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [selected, setSelected] = useState<MarketplaceItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<MarketplaceItem[]>("/api/marketplace").then((d) => {
      setItems(d);
      const first = d[0];
      if (first) { setSelected(first); setActiveTenant(first.id, first.slug); }
    });
  }, [setActiveTenant]);

  const embedCode = selected
    ? `<!-- منشی هوشمند ${selected.name} -->
<script src="${typeof window !== "undefined" ? window.location.origin : "https://your-platform.com"}/widget.js"></script>
<script>
  AIReceptionist.init({
    tenantId: "${selected.id}",
    accentColor: "${selected.accentColor}",
    position: "left"
  });
</script>`
    : "";

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">دموی زنده منشی هوشمند</h1>
        <p className="text-muted-foreground">یک کسب‌وکار را انتخاب کنید و مستقیماً با منشی هوش مصنوعی آن گفتگو کنید. این همان تجربه‌ای است که مشتریان شما خواهند داشت.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Business picker */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Store className="size-4 text-primary" />
            <h3 className="font-semibold">کسب‌وکارها</h3>
            <span className="text-xs text-muted-foreground mr-auto">{toFa(items.length)} کسب‌وکار</span>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto scroll-area">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => { setSelected(it); setActiveTenant(it.id, it.slug); }}
                className={`w-full text-right p-3 rounded-xl border transition flex items-center gap-3 ${selected?.id === it.id ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
              >
                <div className="grid place-items-center size-10 rounded-lg text-white shrink-0" style={{ background: it.accentColor }}>
                  <Store className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{it.businessTypeLabel}</div>
                </div>
                {selected?.id === it.id && <Check className="size-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </Card>

        {/* Embed code */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="size-4 text-primary" />
            <h3 className="font-semibold">کد امبد</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3 leading-5">این کد را در سایت خود قرار دهید تا منشی هوشمند در سایت شما فعال شود:</p>
          <pre className="bg-muted rounded-lg p-3 text-[11px] leading-5 overflow-x-auto scroll-area dir-ltr text-left" dir="ltr">
            <code>{embedCode}</code>
          </pre>
          <Button
            variant="outline" size="sm" className="w-full mt-3 gap-2"
            onClick={() => { navigator.clipboard.writeText(embedCode); setCopied(true); toast.success("کد کپی شد"); setTimeout(() => setCopied(false), 1500); }}
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            کپی کد
          </Button>
          <div className="mt-4 pt-4 border-t space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between"><span>Responsive</span><Check className="size-3.5 text-emerald-600" /></div>
            <div className="flex items-center justify-between"><span>RTL / LTR</span><Check className="size-3.5 text-emerald-600" /></div>
            <div className="flex items-center justify-between"><span>Dark Mode</span><Check className="size-3.5 text-emerald-600" /></div>
            <div className="flex items-center justify-between"><span>Voice Input</span><Check className="size-3.5 text-emerald-600" /></div>
            <div className="flex items-center justify-between"><span>File Upload</span><Check className="size-3.5 text-emerald-600" /></div>
          </div>
        </Card>

        {/* Live preview */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">پیش‌نمایش زنده</h3>
          {selected ? (
            <div className="h-[480px]">
              <FloatingWidget tenantId={selected.id} variant="panel" initialOpen accentColor={selected.accentColor} businessName={selected.name} />
            </div>
          ) : (
            <div className="h-[480px] grid place-items-center text-sm text-muted-foreground">در حال بارگذاری…</div>
          )}
          <Button variant="ghost" size="sm" className="w-full mt-3" onClick={() => useApp.getState().setView("signup")}>
            می‌خواهم برای کسب‌وکارم بسازم <ArrowRight className="size-4" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
