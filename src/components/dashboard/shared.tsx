"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────────── KpiCard ───────────────────────────── */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <div className="text-xs text-muted-foreground truncate">{label}</div>
            <div className="text-2xl font-bold tracking-tight tabular-nums truncate">{value}</div>
            {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
          </div>
          <div
            className="grid place-items-center size-10 rounded-xl shrink-0"
            style={{ background: (accent || "var(--primary)") + "22", color: accent || "var(--primary)" }}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── SectionCard ───────────────────────────── */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={className}>
      {(title || action) && (
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div className="space-y-1">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent className={bodyClassName}>{children}</CardContent>
    </Card>
  );
}

/* ───────────────────────────── Loading ───────────────────────────── */
export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 p-1">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="size-10 rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ───────────────────────────── Error ───────────────────────────── */
export function ErrorBlock({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>خطا</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
        <span>{message || "بارگذاری اطلاعات ناموفق بود."}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="size-3.5" /> تلاش مجدد
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/* ───────────────────────────── Empty ───────────────────────────── */
export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {Icon && (
        <div className="grid place-items-center size-12 rounded-2xl bg-muted text-muted-foreground mb-3">
          <Icon className="size-6" />
        </div>
      )}
      <div className="font-medium">{title}</div>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ───────────────────────────── useAsync ───────────────────────────── */
export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fn()
      .then((r) => mounted && (setData(r), setLoading(false)))
      .catch((e) => mounted && (setError(e?.message || "خطا"), setLoading(false)));
    return () => {
      mounted = false;
    };
  }, [...deps, tick]);

  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/* ───────────────────────────── Percent ───────────────────────────── */
export function pct(used: number, limit: number) {
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
