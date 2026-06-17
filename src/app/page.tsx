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
import { DashboardView } from "@/components/dashboard";
import { AdminView } from "@/components/admin";
import { OperatorView } from "@/components/operator";
import { WidgetDemoPage } from "@/components/widget/widget-demo";
import { FloatingWidget } from "@/components/widget/chat-widget";
import { Sparkles } from "lucide-react";

export default function Home() {
  const { view, session, seeded, setSeeded, activeTenantId, setView } = useApp();
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

  // Restore view based on session on first mount handled by persist already.

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

  const isPublic = ["landing", "marketplace", "pricing", "login", "signup", "widget-demo"].includes(view);
  const showFloating = isPublic && view !== "widget-demo" && (activeTenantId || session?.tenant?.id);

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
