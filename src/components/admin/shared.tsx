"use client";
import * as React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export const CHART_COLORS = ["#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6", "#0ea5e9"];

export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fn()
      .then((r) => {
        if (active) {
          setData(r);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        if (active) {
          setError(e?.message || "خطا در دریافت اطلاعات");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [...deps, reloadKey]);

  return { data, loading, error, reload, setData };
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  accent = "primary",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  accent?: "primary" | "amber" | "pink" | "teal" | "violet" | "sky";
}) {
  const accentMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    pink: "bg-pink-500/10 text-pink-600",
    teal: "bg-teal-500/10 text-teal-600",
    violet: "bg-violet-500/10 text-violet-600",
    sky: "bg-sky-500/10 text-sky-600",
  };
  return (
    <Card className="gap-0 p-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
          <div className="text-xl font-bold tracking-tight truncate">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
        </div>
        {icon && (
          <div className={`grid place-items-center size-9 rounded-lg shrink-0 ${accentMap[accent]}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function CardSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 py-4 gap-0">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-28" />
        </Card>
      ))}
    </div>
  );
}

export function ErrorState({ message, onReload }: { message: string; onReload?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>خطا</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onReload && (
          <Button size="sm" variant="outline" onClick={onReload} className="gap-1.5 shrink-0">
            <RefreshCw className="size-3.5" />
            تلاش مجدد
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-0 gap-0 ${className || ""}`}>
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "trial":
      return "bg-sky-500/15 text-sky-600 border-sky-500/30";
    case "suspended":
      return "bg-rose-500/15 text-rose-600 border-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-600 border-zinc-500/30";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "فعال";
    case "trial":
      return "آزمایشی";
    case "suspended":
      return "معلق";
    default:
      return status;
  }
}
