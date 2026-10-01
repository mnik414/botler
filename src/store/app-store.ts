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
  restoreSession: (s: Session | null) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
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
      // Set the session without changing the current view (used on boot rehydration)
      restoreSession: (session) => set({ session }),
      // Drop the session. Public views stay addressable — only kick the user
      // out of protected views (expired session on dashboard/admin/operator).
      clearSession: () =>
        set((state) => {
          const protectedViews: View[] = ["dashboard", "admin", "operator"];
          const view = protectedViews.includes(state.view) ? "landing" : state.view;
          if (view !== state.view) updateUrl(view);
          return { session: null, view };
        }),
      logout: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {}
        set({ session: null, view: "landing", activeTenantId: null, activeTenantSlug: null, dashboardTab: "overview", adminTab: "overview" });
        updateUrl("landing");
      },
      setActiveTenant: (activeTenantId, activeTenantSlug = null) =>
        set({ activeTenantId, activeTenantSlug }),
      setReferralCode: (referralCode) => set({ referralCode }),
      setDashboardTab: (dashboardTab) => set({ dashboardTab }),
      setAdminTab: (adminTab) => set({ adminTab }),
      setWidgetOpen: (widgetOpen) => set({ widgetOpen }),
    }),
    {
      name: "ai-receptionist",
      // Never persist the session/role — it is re-fetched from the server on boot.
      partialize: (state) => ({
        activeTenantId: state.activeTenantId,
        activeTenantSlug: state.activeTenantSlug,
        dashboardTab: state.dashboardTab,
        adminTab: state.adminTab,
      }),
    }
  )
);
