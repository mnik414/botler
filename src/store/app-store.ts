"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session } from "@/lib/api-client";

export type View =
  | "landing"
  | "marketplace"
  | "pricing"
  | "login"
  | "signup"
  | "dashboard"
  | "admin"
  | "operator"
  | "widget-demo"
  | "business"
  | "referral"
  | "track";

// Map view → URL path (for browser history sync)
const VIEW_PATHS: Record<string, string> = {
  landing: "/",
  marketplace: "/",
  pricing: "/?view=pricing",
  login: "/?view=login",
  signup: "/?view=signup",
  "widget-demo": "/?view=widget-demo",
  business: "", // dynamic: uses /?tenant=SLUG
  referral: "/?view=referral",
  track: "/?view=track",
  dashboard: "/?view=dashboard",
  admin: "/?view=admin",
  operator: "/?view=operator",
};

export function updateUrl(view: View, slug?: string | null) {
  if (typeof window === "undefined") return;
  let path: string;
  if (view === "business" && slug) {
    path = `/?tenant=${encodeURIComponent(slug)}`;
  } else {
    path = VIEW_PATHS[view] || "/";
  }
  window.history.pushState({ view, slug }, "", path);
}

interface AppState {
  view: View;
  session: Session | null;
  activeTenantId: string | null;
  activeTenantSlug: string | null;
  referralCode: string | null;
  dashboardTab: string;
  adminTab: string;
  widgetOpen: boolean;
  setView: (v: View) => void;
  setSession: (s: Session | null) => void;
  logout: () => void;
  setActiveTenant: (id: string | null, slug?: string | null) => void;
  setReferralCode: (c: string | null) => void;
  setDashboardTab: (t: string) => void;
  setAdminTab: (t: string) => void;
  setWidgetOpen: (b: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      view: "landing",
      session: null,
      activeTenantId: null,
      activeTenantSlug: null,
      referralCode: null,
      dashboardTab: "overview",
      adminTab: "overview",
      widgetOpen: false,
      setView: (view) => {
        set({ view });
        const { activeTenantSlug } = get();
        updateUrl(view, activeTenantSlug);
      },
      setSession: (session) => {
        const view = session
          ? (session.role === "super_admin" ? "admin" : session.role === "operator" ? "operator" : "dashboard")
          : "landing";
        set({ session, view });
        updateUrl(view);
      },
      logout: () => {
        set({ session: null, view: "landing" });
        updateUrl("landing");
      },
      setActiveTenant: (activeTenantId, activeTenantSlug = null) =>
        set({ activeTenantId, activeTenantSlug }),
      setReferralCode: (referralCode) => set({ referralCode }),
      setDashboardTab: (dashboardTab) => set({ dashboardTab }),
      setAdminTab: (adminTab) => set({ adminTab }),
      setWidgetOpen: (widgetOpen) => set({ widgetOpen }),
    }),
    { name: "ai-receptionist" }
  )
);