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

function parseViewFromUrl(): { view: string; tenantSlug?: string } {
  if (typeof window === "undefined") return { view: "landing" };
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get("view");
  const tenantSlug = params.get("tenant") || params.get("business");
  const ref = params.get("ref");
  const embed = params.get("embed");

  if (ref) return { view: "referral" };
  if (embed === "1" && params.get("tenantId")) return { view: "landing" };
  if (tenantSlug) return { view: "business", tenantSlug };
  if (viewParam && ["marketplace", "pricing", "login", "signup", "widget-demo", "referral", "track", "dashboard", "admin", "operator"].includes(viewParam)) {
    return { view: viewParam };
  }
  return { view: "landing" };
}

export default function Home() {
  const { view, session, activeTenantId, setView, restoreSession, setActiveTenant, setReferralCode } = useApp();
  const [booting, setBooting] = useState(true);

  // Initial boot: parse URL, resolve embed tenant, rehydrate session from server
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedTenantId = params.get("embed") === "1" ? params.get("tenantId") : null;
    // Embed mode intentionally does NOT persist activeTenantId in the visitor's
    // localStorage — it must not leak into their later browsing session.

    const { view: initialView, tenantSlug } = parseViewFromUrl();
    if (initialView === "referral") {
      const ref = params.get("ref");
      if (ref) {
        setReferralCode(ref.toUpperCase());
        // Survive a refresh on the signup page (mobile back/forward, reload).
        try {
          sessionStorage.setItem("ref-code", ref.toUpperCase());
        } catch {}
      }
      if (!embedTenantId) setView("referral");
    } else if (initialView === "business" && tenantSlug) {
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
    } else if (!embedTenantId && initialView !== "landing") {
      setView(initialView as any);
    }

    // Rehydrate the session from the httpOnly cookie; the store never persists it.
    (async () => {
      try {
        const me = await api<any>("/api/auth/me");
        restoreSession(me);
      } catch {
        restoreSession(null);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // Global 401 handling — drop the local session when the token expires
  useEffect(() => {
    const onUnauthorized = () => useApp.getState().clearSession();
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  // Handle popstate (browser back/forward)
  useEffect(() => {
    const onPopState = () => {
      const { view: newView, tenantSlug } = parseViewFromUrl();
      if (newView === "business" && tenantSlug) {
        (async () => {
          try {
            const items = await api<any[]>("/api/marketplace");
            const found = items.find((m) => m.slug === tenantSlug);
            if (found) {
              setActiveTenant(found.id, found.slug);
              useApp.setState({ view: "business" });
            }
          } catch {}
        })();
      } else {
        // Avoid pushing another history entry while the browser is navigating back
        useApp.setState({ view: newView as any });
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

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

  // Embedded widget mode: render ONLY the widget full-viewport
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const embedTenantId = params?.get("embed") === "1" ? params?.get("tenantId") : null;
  const widgetTenantId = embedTenantId || activeTenantId;
  if (embedTenantId && widgetTenantId) {
    return (
      <div className="fixed inset-0">
        <FloatingWidget tenantId={widgetTenantId} variant="panel" initialOpen accentColor={params?.get("accent") || undefined} />
      </div>
    );
  }

  const isPublic = ["landing", "marketplace", "pricing", "login", "signup", "widget-demo", "business", "referral", "track"].includes(view);
  const showFloating = isPublic && view !== "widget-demo" && view !== "business" && view !== "referral" && view !== "track" && (activeTenantId || session?.tenant?.id);

  return (
    <>
      {view === "dashboard" && session && (session.role === "business_owner" || session.role === "super_admin") ? (
        <DashboardView />
      ) : view === "admin" && session?.role === "super_admin" ? (
        <AdminView />
      ) : view === "operator" && session && (session.role === "operator" || session.role === "business_owner") ? (
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