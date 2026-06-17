"use client";
import * as React from "react";
import { useApp } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard, BookOpen, MessagesSquare, UserPlus, Bot, BarChart3,
  CreditCard, Gift, Code2, Menu, LogOut, MessageSquare, ExternalLink,
  Sparkles, ChevronLeft, Users, type LucideIcon,
} from "lucide-react";
import { BUSINESS_TYPE_LABELS, ROLE_LABELS } from "@/lib/format";
import { getBusinessType } from "@/lib/business-types";
import { FloatingWidget } from "@/components/widget/chat-widget";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { OverviewTab } from "./overview";
import { KnowledgeTab } from "./knowledge";
import { ConversationsTab } from "./conversations";
import { LeadsTab } from "./leads";
import { AgentTab } from "./agent";
import { AnalyticsTab } from "./analytics";
import { BillingTab } from "./billing";
import { ReferralTab } from "./referral";
import { WidgetTab } from "./widget";
import { OperatorsTab } from "./operators";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  group?: string;
}

const NAV: NavItem[] = [
  { key: "overview", label: "نمای کلی", icon: LayoutDashboard, group: "اصلی" },
  { key: "knowledge", label: "پایگاه دانش", icon: BookOpen, group: "اصلی" },
  { key: "conversations", label: "گفتگوها", icon: MessagesSquare, group: "اصلی" },
  { key: "leads", label: "لیدها", icon: UserPlus, group: "اصلی" },
  { key: "operators", label: "اپراتورها", icon: Users, group: "team" },
  { key: "agent", label: "تنظیم منشی", icon: Bot, group: "پیکربندی" },
  { key: "analytics", label: "تحلیل‌ها", icon: BarChart3, group: "پیکربندی" },
  { key: "billing", label: "اشتراک و صورتحساب", icon: CreditCard, group: "حساب" },
  { key: "referral", label: "معرفی و درآمد", icon: Gift, group: "حساب" },
  { key: "widget", label: "نصب ویجت", icon: Code2, group: "حساب" },
];

const TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: { title: "نمای کلی", subtitle: "خلاصه‌ای از وضعیت کسب‌وکار شما" },
  knowledge: { title: "پایگاه دانش", subtitle: "مدیریت دانش منشی هوشمند" },
  conversations: { title: "گفتگوها", subtitle: "تاریخچه گفتگوهای مشتریان با منشی" },
  leads: { title: "لیدها", subtitle: "مدیریت سرنخ‌های فروش" },
  operators: { title: "اپراتورها", subtitle: "مدیریت کاربران دسترسی‌دار به پنل" },
  agent: { title: "تنظیم منشی", subtitle: "پیکربندی شخصیت و رفتار منشی" },
  analytics: { title: "تحلیل‌ها", subtitle: "نمودارها و آمار دقیق" },
  billing: { title: "اشتراک و صورتحساب", subtitle: "مدیریت پلن و پرداخت" },
  referral: { title: "معرفی و درآمد", subtitle: "برنامه همکاری در فروش" },
  widget: { title: "نصب ویجت", subtitle: "قرار دادن منشی در وب‌سایت خود" },
};

export function DashboardView() {
  const { session, dashboardTab, setDashboardTab, setView, logout } = useApp();
  const [chatOpen, setChatOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  if (!session || !session.tenant) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="grid place-items-center size-14 rounded-2xl bg-primary text-primary-foreground mx-auto shadow-lg">
            <Sparkles className="size-7" />
          </div>
          <h1 className="text-xl font-bold">ورود به پنل مدیریت</h1>
          <p className="text-sm text-muted-foreground">
            برای دسترسی به داشبورد مدیریت کسب‌وکار، ابتدا وارد حساب کاربری خود شوید.
          </p>
          <Button size="lg" onClick={() => setView("login")} className="gap-2">
            <LogOut className="size-4" /> ورود به حساب
          </Button>
        </div>
      </div>
    );
  }

  const tenant = session.tenant;
  const bt = getBusinessType(tenant.businessType);
  const tab = dashboardTab in TITLES ? dashboardTab : "overview";
  const meta = TITLES[tab];

  const SidebarBody = (
    <div className="flex flex-col h-full">
      {/* Tenant brand */}
      <div className="p-4 border-b">
        <button
          onClick={() => setView("marketplace")}
          className="flex items-center gap-3 w-full text-right hover:bg-accent rounded-lg p-2 -m-2 transition"
        >
          <div
            className="grid place-items-center size-10 rounded-xl text-white shrink-0 font-bold"
            style={{ background: tenant.accentColor }}
          >
            {tenant.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{tenant.name}</div>
            <div className="text-[11px] text-muted-foreground">{BUSINESS_TYPE_LABELS[tenant.businessType] || bt.label}</div>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scroll-area p-2 space-y-0.5">
        {NAV.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setDashboardTab(item.key);
                setMobileNavOpen(false);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1 text-right">{item.label}</span>
              {active && <ChevronLeft className="size-4" />}
            </button>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="p-3 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-accent transition text-right">
              <Avatar className="size-9 border">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {session.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{session.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[session.role] || session.role}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {session.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("marketplace")}>
              <ExternalLink className="size-4" /> مشاهده در بازار کسب‌وکارها
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                logout();
                toast.success("از حساب کاربری خارج شدید.");
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" /> خروج از حساب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-muted/30" dir="rtl">
      {/* Desktop sidebar (right side in RTL) */}
      <aside className="hidden lg:flex w-64 shrink-0 border-l bg-card">
        {SidebarBody}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden fixed top-3 right-3 z-30 bg-card shadow"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="p-0 w-72 max-w-[85vw]">
          <SheetTitle className="sr-only">منو</SheetTitle>
          {SidebarBody}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b">
          <div className="flex items-center justify-between gap-3 px-4 lg:px-6 py-3">
            <div className="lg:pr-10 pr-10">
              <h1 className="text-base lg:text-lg font-bold leading-tight">{meta.title}</h1>
              <p className="text-[11px] lg:text-xs text-muted-foreground hidden sm:block">{meta.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex gap-1.5 text-muted-foreground"
                onClick={() => setView("marketplace")}
              >
                <ExternalLink className="size-4" />
                <span className="hidden md:inline">صفحه عمومی</span>
              </Button>
              <Sheet open={chatOpen} onOpenChange={setChatOpen}>
                <SheetTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <MessageSquare className="size-4" />
                    <span className="hidden sm:inline">گفتگو با منشی</span>
                    <span className="sm:hidden">منشی</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-full sm:max-w-md">
                  <SheetTitle className="sr-only">گفتگو با منشی</SheetTitle>
                  <div className="h-full">
                    <FloatingWidget tenantId={tenant.id} variant="panel" initialOpen />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 lg:px-6 py-5 lg:py-6 max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {tab === "overview" && <OverviewTab tenantId={tenant.id} />}
                {tab === "knowledge" && <KnowledgeTab tenantId={tenant.id} />}
                {tab === "conversations" && <ConversationsTab tenantId={tenant.id} />}
                {tab === "leads" && <LeadsTab tenantId={tenant.id} />}
                {tab === "operators" && <OperatorsTab tenantId={tenant.id} />}
                {tab === "agent" && <AgentTab tenantId={tenant.id} />}
                {tab === "analytics" && <AnalyticsTab tenantId={tenant.id} />}
                {tab === "billing" && <BillingTab tenantId={tenant.id} />}
                {tab === "referral" && <ReferralTab tenantId={tenant.id} />}
                {tab === "widget" && <WidgetTab tenantId={tenant.id} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
