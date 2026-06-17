"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { api } from "@/lib/api-client";
import { PublicShell } from "@/components/public/public-shell";
import { LandingPage } from "@/components/public/landing";
import { MarketplacePage } from "@/components/public/marketplace";
import { PricingPage } from "@/components/public/pricing";
import { LoginPage } from "@/components/public/login";
import { SignupPage } from "@/components/public/signup";
import { BusinessProfilePage } from "@/components/public/business-profile";
import { ReferralPage } from "@/components/public/referral";
import { TrackRequestPage } from "@/components/public/track-request";
import { DashboardView } from "@/components/dashboard";
import { AdminView } from "@/components/admin";
import { OperatorView } from "@/components/operator";
import { WidgetDemoPage } from "@/components/widget/widget-demo";
import { FloatingWidget } from "@/components/widget/chat-widget";
import { Sparkles } from "lucide-react";

export default function Home() {
  const { view, session, seeded, setSeeded, activeTenantId, setView, setActiveTenant, setReferralCode } = useApp();
  const [booting, setBooting] = useState(true);

  // One-time seeding on first load
  useEffect(() => {
    (async () => {
      try {
        await api("/api/seed", { method: "POST", body: JSON.stringify({}) });
        setSeeded(true);
      } catch {
        // ignore — may already be seeded
      } finally {
        setBooting(false);
      }
    })();
  }, [setSeeded]);

  // Handle URL params: ?ref=CODE (referral landing), ?embed=1&tenantId=ID (widget iframe),
  // ?tenant=SLUG (direct business profile). This makes the static /widget.js + shareable links work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const embed = params.get("embed");
    const tenantId = params.get("tenantId");
    const tenantSlug = params.get("tenant") || params.get("business");

    if (ref) {
      setReferralCode(ref.toUpperCase());
      setView("referral");
      return;
    }
    if (embed === "1" && tenantId) {
      // Embedded widget mode — set active tenant, render only the widget (no shell)
      setActiveTenant(tenantId);
      return;
    }
    if (tenantSlug) {
      // Resolve slug → tenant id and open business profile
      (async () => {
        try {
          const items = await api<any[]>("/api/marketplace");
          const found = items.find((m) => m.slug === tenantSlug);
          if (found) {
            setActiveTenant(found.id, found.slug);
            setView("business");
          }
        } catch {}
      })();
    }
  }, [setReferralCode, setView, setActiveTenant]);

  if (booting) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="grid place-items-center size-14 rounded-2xl bg-primary text-primary-foreground shadow-lg animate-pulse">
            <Sparkles className="size-7" />
          </div>
          <div className="text-sm text-muted-foreground">در حال آماده‌سازی پلتفرم منشی هوشمند…</div>
        </div>
      </div>
    );
  }

  // Embedded widget mode: render ONLY the widget full-viewport (for the iframe in widget.js)
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isEmbedded = params?.get("embed") === "1" && activeTenantId;
  if (isEmbedded) {
    return (
      <div className="fixed inset-0">
        <FloatingWidget tenantId={activeTenantId} variant="panel" initialOpen accentColor={params?.get("accent") || undefined} />
      </div>
    );
  }

  const isPublic = ["landing", "marketplace", "pricing", "login", "signup", "widget-demo", "business", "referral", "track"].includes(view);
  const showFloating = isPublic && view !== "widget-demo" && view !== "business" && view !== "referral" && view !== "track" && (activeTenantId || session?.tenant?.id);

  return (
    <>
      {view === "dashboard" && session ? (
        <DashboardView />
      ) : view === "admin" && session?.role === "super_admin" ? (
        <AdminView />
      ) : view === "operator" && session ? (
        <OperatorView />
      ) : isPublic ? (
        <PublicShell>
          {view === "landing" && <LandingPage />}
          {view === "marketplace" && <MarketplacePage />}
          {view === "pricing" && <PricingPage />}
          {view === "login" && <LoginPage />}
          {view === "signup" && <SignupPage />}
          {view === "widget-demo" && <WidgetDemoPage />}
          {view === "business" && <BusinessProfilePage />}
          {view === "referral" && <ReferralPage />}
          {view === "track" && <TrackRequestPage />}
        </PublicShell>
      ) : (
        <PublicShell>
          <LandingPage />
        </PublicShell>
      )}

      {showFloating && <FloatingWidget tenantId={(activeTenantId || session?.tenant?.id) as string} />}
    </>
  );
}
