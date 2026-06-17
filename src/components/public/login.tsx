"use client";
import { useState } from "react";
import { useApp } from "@/store/app-store";
import { api, type Session } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, Mail, Lock, LogIn, UserCog, Store, Headphones, ArrowLeft, Info } from "lucide-react";

const DEMO_CREDS = [
  {
    role: "مدیر سیستم",
    email: "admin@receptionist.ai",
    password: "admin123",
    icon: UserCog,
    desc: "دسترسی کامل به همه بخش‌ها",
  },
  {
    role: "صاحب کسب‌وکار",
    email: "owner1@cafe-bamdad.com",
    password: "demo123",
    icon: Store,
    desc: "داشبورد مدیریت کافه بامداد",
  },
  {
    role: "اپراتور",
    email: "op1@cafe-bamdad.com",
    password: "demo123",
    icon: Headphones,
    desc: "پاسخ به گفتگوهای منتقل‌شده",
  },
];

export function LoginPage() {
  const { setView, setSession } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("ایمیل و رمز عبور را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      const res = await api<Session>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      toast.success("ورود موفقیت‌آمیز بود");
      setSession(res);
    } catch (err: any) {
      toast.error(err.message || "ورود ناموفق بود");
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (em: string, pw: string) => {
    setEmail(em);
    setPassword(pw);
    toast.info("اطلاعات نمونه پر شد");
  };

  return (
    <div className="container mx-auto px-4 py-10 md:py-16 min-h-[80vh] flex items-center justify-center">
      <div className="grid lg:grid-cols-2 gap-8 w-full max-w-4xl items-center">
        {/* Brand side */}
        <div className="hidden lg:block">
          <button onClick={() => setView("landing")} className="flex items-center gap-2 mb-6">
            <div className="grid place-items-center size-10 rounded-xl bg-primary text-primary-foreground shadow">
              <Sparkles className="size-5" />
            </div>
            <div className="text-right">
              <div className="font-bold">منشی هوشمند</div>
              <div className="text-[10px] text-muted-foreground">AI Receptionist Platform</div>
            </div>
          </button>
          <h1 className="text-3xl font-black leading-tight mb-3">
            دوباره خوش آمدید 👋
          </h1>
          <p className="text-muted-foreground leading-7">
            وارد پنل مدیریت شوید تا منشی‌ها، گفتگوها، لیدها و تنظیمات کسب‌وکار خود را
            مدیریت کنید.
          </p>

          {/* Demo credentials */}
          <Alert className="mt-6">
            <Info className="size-4" />
            <AlertTitle>اطلاعات ورود نمونه</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {DEMO_CREDS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.email}
                      onClick={() => quickFill(c.email, c.password)}
                      className="w-full text-right flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors border border-transparent hover:border-border"
                    >
                      <div className="grid place-items-center size-8 rounded-lg bg-primary/10 text-primary shrink-0">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{c.role}</div>
                        <div className="text-[11px] text-muted-foreground truncate" dir="ltr">{c.email}</div>
                      </div>
                      <ArrowLeft className="size-3.5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            </AlertDescription>
          </Alert>
        </div>

        {/* Form side */}
        <Card className="w-full">
          <CardHeader className="gap-2">
            <button
              onClick={() => setView("landing")}
              className="lg:hidden flex items-center gap-2 mb-2"
            >
              <div className="grid place-items-center size-9 rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <span className="font-bold">منشی هوشمند</span>
            </button>
            <CardTitle className="text-2xl">ورود به حساب</CardTitle>
            <CardDescription>برای دسترسی به پنل مدیریت وارد شوید.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">ایمیل</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pr-9 text-left"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-9 text-left"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    در حال ورود…
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    ورود
                  </>
                )}
              </Button>
            </form>

            {/* Mobile demo creds */}
            <div className="lg:hidden mt-4">
              <Alert>
                <Info className="size-4" />
                <AlertTitle>ورود سریع با حساب نمونه</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    {DEMO_CREDS.map((c) => {
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.email}
                          onClick={() => quickFill(c.email, c.password)}
                          className="w-full text-right flex items-center gap-2 p-2 rounded-md hover:bg-accent"
                        >
                          <div className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary shrink-0">
                            <Icon className="size-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium">{c.role}</div>
                            <div className="text-[10px] text-muted-foreground truncate" dir="ltr">{c.email}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </AlertDescription>
              </Alert>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              حساب کاربری ندارید؟{" "}
              <Button variant="link" className="p-0 h-auto font-medium" onClick={() => setView("signup")}>
                ثبت‌نام
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
