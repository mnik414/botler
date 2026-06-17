"use client";
import { useApp } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Sparkles, Menu, X, Moon, Sun, Bot, Store, Building2, Headphones } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { ROLE_LABELS } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV = [
  { key: "landing", label: "خانه" },
  { key: "marketplace", label: "بازار کسب‌وکارها" },
  { key: "pricing", label: "پلن‌ها" },
] as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { view, setView, session, logout } = useApp();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    // next-themes needs a client-only render to avoid hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <button onClick={() => setView("landing")} className="flex items-center gap-2">
            <div className="grid place-items-center size-9 rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div className="text-right leading-tight">
              <div className="font-bold text-base">منشی هوشمند</div>
              <div className="text-[10px] text-muted-foreground">AI Receptionist Platform</div>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Button
                key={n.key}
                variant={view === n.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(n.key as any)}
                className="font-medium"
              >
                {n.label}
              </Button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {mounted && (
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            )}

            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Avatar className="size-6"><AvatarFallback className="text-[10px] bg-primary/15 text-primary">{session.name?.[0]}</AvatarFallback></Avatar>
                    <span className="hidden sm:inline">{session.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">{session.name}</span>
                    <span className="text-xs text-muted-foreground">{ROLE_LABELS[session.role]}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => useApp.getState().setView(session.role === "super_admin" ? "admin" : session.role === "operator" ? "operator" : "dashboard")}>
                    ورود به پنل
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive">خروج</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setView("login")} className="hidden sm:inline-flex">ورود</Button>
                <Button size="sm" onClick={() => setView("signup")} className="gap-1.5">
                  <Bot className="size-4" />
                  ساخت منشی
                </Button>
              </>
            )}

            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t bg-background px-4 py-3 flex flex-col gap-1">
            {NAV.map((n) => (
              <Button key={n.key} variant={view === n.key ? "secondary" : "ghost"} className="justify-start" onClick={() => { setView(n.key as any); setMobileOpen(false); }}>
                {n.label}
              </Button>
            ))}
            <Button variant="ghost" className="justify-start" onClick={() => { setView("login"); setMobileOpen(false); }}>ورود</Button>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer (sticky to bottom) */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="container mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="grid place-items-center size-8 rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4" /></div>
              <span className="font-bold">منشی هوشمند</span>
            </div>
            <p className="text-sm text-muted-foreground leading-6">پلتفرم ساخت منشی هوش مصنوعی اختصاصی برای کسب‌وکارها. پاسخگویی ۲۴ ساعته، فروش، رزرو و پشتیبانی.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">محصول</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><button className="hover:text-foreground" onClick={() => setView("pricing")}>پلن‌ها و تعرفه</button></li>
              <li><button className="hover:text-foreground" onClick={() => setView("signup")}>ساخت منشی رایگان</button></li>
              <li><button className="hover:text-foreground" onClick={() => setView("marketplace")}>بازار کسب‌وکارها</button></li>
              <li><button className="hover:text-foreground" onClick={() => setView("widget-demo")}>دمو ویجت</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">امکانات</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Bot className="size-3.5" /> منشی هوشمند RAG</li>
              <li className="flex items-center gap-2"><Headphones className="size-3.5" /> انتقال به اپراتور</li>
              <li className="flex items-center gap-2"><Store className="size-3.5" /> سیستم لید و فروش</li>
              <li className="flex items-center gap-2"><Building2 className="size-3.5" /> چندمستاجری کامل</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">تماس</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>support@receptionist.ai</li>
              <li>۰۲۱-۹۱۰۰۲۰۳۰</li>
              <li>تهران، سعادت‌آباد</li>
            </ul>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">
          © ۱۴۰۴ منشی هوشمند — تمام حقوق محفوظ است. ساخته‌شده با Next.js و هوش مصنوعی Z.ai
        </div>
      </footer>
    </div>
  );
}
