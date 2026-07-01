"use client";
import { useState } from "react";
import { useApp } from "@/store/app-store";
import { api, type Session } from "@/lib/api-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Mail, Lock, LogIn } from "lucide-react";

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