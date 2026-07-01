"use client";
import * as React from "react";
import { useApp } from "@/store/app-store";
import { ROLE_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Building2, CreditCard, Wallet, Cpu, Sparkles, LogOut, Menu, ShieldAlert, Moon, Sun, ChevronLeft, UserPlus, Receipt, Lock,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { AdminOverview } from "./overview";
import { AdminTenants } from "./tenants";
import { AdminPlans } from "./plans";
import { AdminRevenue } from "./revenue";
import { AdminTokens } from "./tokens";
import { AdminLeads } from "./leads";
import { AdminPayments } from "./payments";
import { AdminAiProviders } from "./ai-providers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const NAV = [
  { key: "overview", label: "نمای کلی", icon: LayoutDashboard, title: "نمای کلی پلتفرم" },
  { key: "tenants", label: "کسب‌وکارها", icon: Building2, title: "مدیریت کسب‌وکارها" },
  { key: "leads", label: "لیدها", icon: UserPlus, title: "لیدهای جذب‌شده در کل پلتفرم" },
  { key: "payments", label: "پرداخت‌ها", icon: Receipt, title: "مدیریت صورتحساب و پرداخت‌ها" },
  { key: "plans", label: "تعرفه‌ها", icon: CreditCard, title: "مدیریت تعرفه و پلن‌ها" },
  { key: "revenue", label: "درآمد", icon: Wallet, title: "تحلیل درآمد پلتفرم" },
  { key: "tokens", label: "توکن‌ها", icon: Cpu, title: "مصرف توکن هوش مصنوعی" },
  { key: "ai-providers", label: "موتور هوش مصنوعی", icon: Cpu, title: "مدیریت مدل‌ها و APIهای هوش مصنوعی" },
] as const;

export function AdminView() {
  const { session, adminTab, setAdminTab, logout } = useApp();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);

  // Safe-mount flag for theme toggle (avoids hydration mismatch)
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Internal guard: super_admin only
  if (!session || session.role !== "super_admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="grid place-items-center size-16 rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold mb-1">دسترسی غیرمجاز</h1>
            <p className="text-sm text-muted-foreground">برای ورود به پنل مدیریت سیستم، نیاز به نقش مدیر سیستم دارید.</p>
          </div>
          <Button variant="destructive" onClick={logout} className="gap-1.5">
            <LogOut className="size-4" />
            خروج
          </Button>
        </div>
      </div>
    );
  }

  const active = NAV.find((n) => n.key === adminTab) || NAV[0];

  const sidebarContent = (
    <>
      <div className="px-4 py-4 border-b">
        <button
          onClick={() => useApp.getState().setView("landing")}
          className="flex items-center gap-2 w-full"
        >
          <div className="grid place-items-center size-9 rounded-xl bg-primary text-primary-foreground shadow-sm shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div className="text-right leading-tight">
            <div className="font-bold text-sm">منشی هوشمند</div>
            <div className="text-[10px] text-muted-foreground">پنل مدیریت سیستم</div>
          </div>
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto scroll-area">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = adminTab === n.key;
          return (
            <button
              key={n.key}
              onClick={() => {
                setAdminTab(n.key);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 text-right">{n.label}</span>
              {isActive && <ChevronLeft className="size-4" />}
            </button>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 h-auto py-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/15 text-primary text-xs">
                  {session.name?.[0] || "A"}
                </AvatarFallback>
              </Avatar>
              <div className="text-right leading-tight flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{session.name}</div>
                <div className="text-[10px] text-muted-foreground">{ROLE_LABELS[session.role]}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{session.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{session.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { setPasswordDialogOpen(true); setCurrentPassword(""); setNewPassword(""); }}>
              <Lock className="size-4" /> تغییر رمز عبور
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive gap-2">
              <LogOut className="size-4" />
              خروج از حساب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-row-reverse bg-muted/30">
      {/* Desktop Sidebar (right in RTL) */}
      <aside className="hidden md:flex w-64 flex-col bg-background border-l shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>منوی مدیریت</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">{sidebarContent}</div>
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* Mobile menu trigger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate">{active.title}</h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">پنل مدیریت پلتفرم منشی هوشمند</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mounted && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  title="تغییر تم"
                >
                  {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              )}
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-muted-foreground">سیستم فعال</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4">
          <motion.div
            key={adminTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-7xl"
          >
            {adminTab === "overview" && <AdminOverview />}
            {adminTab === "tenants" && <AdminTenants />}
            {adminTab === "leads" && <AdminLeads />}
            {adminTab === "payments" && <AdminPayments />}
            {adminTab === "plans" && <AdminPlans />}
            {adminTab === "revenue" && <AdminRevenue />}
            {adminTab === "tokens" && <AdminTokens />}
            {adminTab === "ai-providers" && <AdminAiProviders />}
          </motion.div>
        </main>
      </div>

      {/* Change password dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تغییر رمز عبور</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!currentPassword || newPassword.length < 6) {
                toast.error("رمز عبور جدید باید حداقل ۶ کاراکتر باشد");
                return;
              }
              setChangingPassword(true);
              try {
                await api("/api/auth/change-password", {
                  method: "POST",
                  body: JSON.stringify({ currentPassword, newPassword }),
                });
                toast.success("رمز عبور با موفقیت تغییر کرد");
                setPasswordDialogOpen(false);
                setCurrentPassword("");
                setNewPassword("");
              } catch (err: any) {
                toast.error(err.message || "تغییر رمز عبور ناموفق بود");
              } finally {
                setChangingPassword(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="admin-current-password">رمز عبور فعلی</Label>
              <Input
                id="admin-current-password"
                type="password"
                dir="ltr"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="text-left"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-new-password">رمز عبور جدید</Label>
              <Input
                id="admin-new-password"
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="text-left"
                required
                minLength={6}
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setPasswordDialogOpen(false)}>
                انصراف
              </Button>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword ? "در حال تغییر…" : "تغییر رمز عبور"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}