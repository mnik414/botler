"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { api, type MarketplaceItem, type KnowledgeItem } from "@/lib/api-client";
import { FloatingWidget } from "@/components/widget/chat-widget";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight, MapPin, Phone, Instagram, Globe, Clock, MessageSquare,
  Sparkles, ShieldCheck, Bot, Store, ChevronRight, ExternalLink,
} from "lucide-react";
import { BUSINESS_TYPE_LABELS, getBusinessType } from "@/lib/business-types";
import { toFa } from "@/lib/format";

export function BusinessProfilePage() {
  const { activeTenantId, activeTenantSlug, setActiveTenant, setView } = useApp();
  const [item, setItem] = useState<MarketplaceItem | null>(null);
  const [faqs, setFaqs] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeTenantId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Primary: fetch the single tenant directly (most reliable)
        const t = await api<any>(`/api/tenants/${activeTenantId}`);
        if (!mounted) return;
        const bt = getBusinessType(t.businessType);
        const found: MarketplaceItem | null = t
          ? {
              id: t.id,
              slug: t.slug,
              name: t.name,
              description: t.description,
              businessType: t.businessType,
              businessTypeLabel: bt.label,
              icon: bt.icon,
              category: t.category,
              accentColor: t.accentColor,
              instagram: t.instagram,
              phone: t.phone,
              address: t.address,
            }
          : null;
        setItem(found);
        // Load FAQ knowledge for the "frequently asked" section
        try {
          const k = await api<KnowledgeItem[]>(`/api/knowledge?tenantId=${activeTenantId}`);
          if (!mounted) return;
          setFaqs(k.filter((x) => x.type === "faq").slice(0, 6));
        } catch {}
      } catch {
        // Fallback: try the marketplace list
        try {
          const all = await api<MarketplaceItem[]>("/api/marketplace");
          if (!mounted) return;
          setItem(all.find((m) => m.id === activeTenantId) || null);
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeTenantId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Skeleton className="h-48 w-full rounded-2xl mb-6" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-2xl md:col-span-2" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Store className="size-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">کسب‌وکار یافت نشد</h2>
        <p className="text-muted-foreground mb-6">ممکن است این کسب‌وکار دیگر فعال نباشد.</p>
        <Button onClick={() => setView("marketplace")}>بازگشت به بازار کسب‌وکارها</Button>
      </div>
    );
  }

  const accent = item.accentColor;
  const bt = getBusinessType(item.businessType);

  return (
    <div className="min-h-[60vh]">
      {/* Hero banner */}
      <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}>
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="container mx-auto px-4 py-12 relative">
          <button
            onClick={() => setView("marketplace")}
            className="flex items-center gap-1 text-white/85 hover:text-white text-sm mb-6 transition"
          >
            <ChevronRight className="size-4" /> بازگشت به بازار
          </button>

          <div className="flex flex-col md:flex-row md:items-center gap-5 text-white">
            <div className="grid place-items-center size-20 rounded-2xl bg-white/20 backdrop-blur shrink-0 border border-white/30">
              <Store className="size-9" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/25">{item.businessTypeLabel}</Badge>
                <Badge className="bg-emerald-400/30 text-white border-emerald-100/30 gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-300 pulse-dot" /> آنلاین
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold mb-1">{item.name}</h1>
              <p className="text-white/90 text-sm leading-6 max-w-2xl">{item.description}</p>
            </div>
            <div className="flex md:flex-col gap-2">
              <Button variant="secondary" className="gap-2 shadow" onClick={() => {
                const f = document.getElementById("chat-section");
                f?.scrollIntoView({ behavior: "smooth" });
              }}>
                <MessageSquare className="size-4" /> گفتگو با منشی
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 grid lg:grid-cols-5 gap-6">
        {/* Left: info + FAQ */}
        <div className="lg:col-span-3 space-y-6">
          {/* Contact info */}
          <Card className="p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> اطلاعات تماس
            </h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {item.phone && (
                <a href={`tel:${item.phone}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition">
                  <Phone className="size-4 text-muted-foreground" />
                  <span dir="ltr">{toFa(item.phone)}</span>
                </a>
              )}
              {item.instagram && (
                <div className="flex items-center gap-2 p-2">
                  <Instagram className="size-4 text-muted-foreground" />
                  <span dir="ltr">{item.instagram}</span>
                </div>
              )}
              {item.address && (
                <div className="flex items-start gap-2 p-2 sm:col-span-2">
                  <MapPin className="size-4 text-muted-foreground mt-0.5" />
                  <span>{item.address}</span>
                </div>
              )}
            </div>
          </Card>

          {/* FAQ */}
          {faqs.length > 0 && (
            <Card className="p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Sparkles className="size-4 text-primary" /> سوالات متداول
              </h3>
              <div className="space-y-3">
                {faqs.map((f) => (
                  <div key={f.id} className="border rounded-xl p-3 hover:bg-accent/40 transition">
                    <div className="font-medium text-sm mb-1 flex items-start gap-2">
                      <span className="text-primary font-bold">س:</span>
                      <span>{f.question || f.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-6 pr-5">{f.content}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                <Bot className="size-3.5" /> این پاسخ‌ها توسط منشی هوشمند از پایگاه دانش {item.name} ارائه می‌شود.
              </p>
            </Card>
          )}

          {/* Trust badges */}
          <Card className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="grid place-items-center size-10 mx-auto rounded-xl bg-emerald-500/10 text-emerald-600 mb-2"><ShieldCheck className="size-5" /></div>
                <div className="text-xs font-medium">پاسخگویی خودکار</div>
              </div>
              <div>
                <div className="grid place-items-center size-10 mx-auto rounded-xl bg-amber-500/10 text-amber-600 mb-2"><Clock className="size-5" /></div>
                <div className="text-xs font-medium">۲۴ ساعته</div>
              </div>
              <div>
                <div className="grid place-items-center size-10 mx-auto rounded-xl bg-pink-500/10 text-pink-600 mb-2"><Bot className="size-5" /></div>
                <div className="text-xs font-medium">هوش مصنوعی</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: chat (sticky) */}
        <div className="lg:col-span-2" id="chat-section">
          <div className="lg:sticky lg:top-20">
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" /> گفتگوی زنده با منشی
                </h3>
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <span className="size-1.5 rounded-full bg-emerald-500 pulse-dot" /> آنلاین
                </Badge>
              </div>
              <div className="h-[480px]">
                <FloatingWidget tenantId={item.id} variant="panel" initialOpen accentColor={accent} businessName={item.name} />
              </div>
            </Card>
            <p className="text-xs text-center text-muted-foreground mt-3 px-4">
              این منشی توسط پلتفرم <button onClick={() => setView("landing")} className="text-primary font-medium hover:underline">منشی هوشمند</button> قدرت گرفته است.
              <Button variant="link" size="sm" className="px-1 text-xs" onClick={() => setView("signup")}>
                برای کسب‌وکار خود هم بسازید <ArrowRight className="size-3" />
              </Button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
