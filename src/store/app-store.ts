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
  | "dashboard" // business owner
  | "admin" // super admin
  | "operator"
  | "widget-demo";

interface AppState {
  view: View;
  session: Session | null;
  activeTenantId: string | null;
  activeTenantSlug: string | null;
  seeded: boolean;
  dashboardTab: string;
  adminTab: string;
  widgetOpen: boolean;
  setView: (v: View) => void;
  setSession: (s: Session | null) => void;
  logout: () => void;
  setActiveTenant: (id: string | null, slug?: string | null) => void;
  setSeeded: (b: boolean) => void;
  setDashboardTab: (t: string) => void;
  setAdminTab: (t: string) => void;
  setWidgetOpen: (b: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      view: "landing",
      session: null,
      activeTenantId: null,
      activeTenantSlug: null,
      seeded: false,
      dashboardTab: "overview",
      adminTab: "overview",
      widgetOpen: false,
      setView: (view) => set({ view }),
      setSession: (session) =>
        set({
          session,
          view: session ? (session.role === "super_admin" ? "admin" : session.role === "operator" ? "operator" : "dashboard") : "landing",
        }),
      logout: () => set({ session: null, view: "landing" }),
      setActiveTenant: (activeTenantId, activeTenantSlug = null) => set({ activeTenantId, activeTenantSlug }),
      setSeeded: (seeded) => set({ seeded }),
      setDashboardTab: (dashboardTab) => set({ dashboardTab }),
      setAdminTab: (adminTab) => set({ adminTab }),
      setWidgetOpen: (widgetOpen) => set({ widgetOpen }),
    }),
    { name: "ai-receptionist" }
  )
);
