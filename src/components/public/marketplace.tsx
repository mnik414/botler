"use client";
import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/store/app-store";
import { api, type MarketplaceItem } from "@/lib/api-client";
import { BUSINESS_TYPES, MARKETPLACE_CATEGORIES, getBusinessType } from "@/lib/business-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageSquare, Instagram, Phone, MapPin, Store, UtensilsCrossed, Stethoscope, Building2, Scale, Plane, BedDouble, GraduationCap, Home, Briefcase, type LucideIcon } from "lucide-react";

const BIZ_ICONS: Record<string, LucideIcon> = {
  ShoppingBag: Store,
  UtensilsCrossed,
  Stethoscope,
  Building2,
  Scale,
  Plane,
  BedDouble,
  GraduationCap,
  Home,
  Briefcase,
};

export function MarketplacePage() {
  const { setView, setActiveTenant } = useApp();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category && category !== "all") params.set("category", category);
      if (debouncedQ) params.set("q", debouncedQ);
      const url = `/api/marketplace${params.toString() ? `?${params.toString()}` : ""}`;
      const data = await api<MarketplaceItem[]>(url);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedQ]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const talkTo = (item: MarketplaceItem) => {
    setActiveTenant(item.id, item.slug);
    setView("business");
  };

  return (
    <div className="container mx-auto px-4 py-10 md:py-14">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <Badge variant="secondary" className="mb-3 gap-1.5">
          <Store className="size-3.5" />
          بازار کسب‌وکارها
        </Badge>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          با منشی کسب‌وکارهای فعال گفتگو کنید
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">
          فهرستی از کسب‌وکارهایی که از منشی هوشمند پلتفرم ما استفاده می‌کنند.
          روی هرکدام کلیک کنید و مستقیماً با منشی واقعی آن‌ها گفتگو را آغاز کنید.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl mx-auto mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی کسب‌وکار… (مثلاً کافه، کلینیک، فروشگاه)"
            className="pr-9"
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        {MARKETPLACE_CATEGORIES.map((c) => (
          <Button
            key={c.code}
            size="sm"
            variant={category === c.code ? "default" : "outline"}
            onClick={() => setCategory(c.code)}
            className="rounded-full"
          >
            {c.label}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-12 w-full mt-4" />
              <Skeleton className="h-9 w-full mt-3" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 max-w-md mx-auto">
          <div className="grid place-items-center size-16 rounded-2xl bg-muted mx-auto mb-4">
            <Search className="size-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">نتیجه‌ای یافت نشد</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            با عبارت دیگری جستجو کنید یا فیلتر دسته‌بندی را تغییر دهید.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setQ("");
              setCategory("all");
            }}
          >
            پاک کردن فیلترها
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const Icon = BIZ_ICONS[getBusinessType(item.businessType).icon] || Briefcase;
            return (
              <Card key={item.id} className="h-full gap-3 py-5 hover:shadow-md transition-shadow">
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="grid place-items-center size-12 rounded-xl text-white shadow-sm shrink-0"
                      style={{ backgroundColor: item.accentColor }}
                    >
                      <Icon className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{item.name}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {item.businessTypeLabel}
                      </Badge>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-6 min-h-[2.5rem]">
                      {item.description}
                    </p>
                  )}
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {item.instagram && (
                      <div className="flex items-center gap-1.5">
                        <Instagram className="size-3.5 shrink-0" />
                        <span className="truncate">{item.instagram}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="size-3.5 shrink-0" />
                        <span className="truncate" dir="ltr">{item.phone}</span>
                      </div>
                    )}
                    {item.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                    )}
                  </div>
                  <Button size="sm" className="w-full gap-1.5 mt-1" onClick={() => talkTo(item)}>
                    <MessageSquare className="size-4" />
                    گفتگو با منشی
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="text-center mt-12">
        <p className="text-sm text-muted-foreground">
          کسب‌وکار شما در این فهرست نبود؟{" "}
          <Button variant="link" className="p-0 h-auto" onClick={() => setView("signup")}>
            همین حالا منشی اختصاصی بسازید
          </Button>
        </p>
      </div>
    </div>
  );
}
