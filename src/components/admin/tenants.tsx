"use client";
import * as React from "react";
import { useAsync, ErrorState, SectionCard, statusBadgeClass, statusLabel } from "./shared";
import { api } from "@/lib/api-client";
import { useApp } from "@/store/app-store";
import { formatToman, formatNumber, formatDate, BUSINESS_TYPE_LABELS } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Building2, LogIn, Pause, Play, MessageSquare, UserPlus, BookOpen, Users, Phone, Globe, Instagram } from "lucide-react";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  description: string;
  phone: string;
  website: string;
  instagram: string;
  address: string;
  accentColor: string;
  status: string;
  createdAt: string;
  plan: { id: string; code: string; name: string; priceMonthly: number } | null;
  subscription: { status: string; renewsAt: string } | null;
  _count: { conversations: number; leads: number; knowledge: number; users: number };
}

const STATUS_FILTERS = [
  { value: "all", label: "همه" },
  { value: "active", label: "فعال" },
  { value: "trial", label: "آزمایشی" },
  { value: "suspended", label: "معلق" },
];

const PLAN_FILTERS = [
  { value: "all", label: "همه پلن‌ها" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

export function AdminTenants() {
  const { setActiveTenant, setView } = useApp();
  const { data, loading, error, reload, setData } = useAsync<TenantRow[]>(() => api("/api/tenants"), []);
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [planFilter, setPlanFilter] = React.useState("all");
  const [selected, setSelected] = React.useState<TenantRow | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  const filtered = React.useMemo(() => {
    if (!data) return [];
    return data.filter((t) => {
      const matchesQuery = !query || t.name.includes(query) || t.slug.includes(query) || t.phone.includes(query);
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPlan = planFilter === "all" || t.plan?.code === planFilter;
      return matchesQuery && matchesStatus && matchesPlan;
    });
  }, [data, query, statusFilter, planFilter]);

  async function changeStatus(t: TenantRow, newStatus: string) {
    setActionLoading(true);
    try {
      await api(`/api/tenants/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(newStatus === "suspended" ? "کسب‌وکار معلق شد" : "کسب‌وکار فعال شد");
      // Update local list
      if (setData && data) {
        setData(data.map((x) => (x.id === t.id ? { ...x, status: newStatus } : x)));
      }
      if (selected?.id === t.id) {
        setSelected({ ...t, status: newStatus });
      }
    } catch (e: any) {
      toast.error(e?.message || "خطا در عملیات");
    } finally {
      setActionLoading(false);
    }
  }

  function impersonate(t: TenantRow) {
    setActiveTenant(t.id, t.slug);
    setView("widget-demo");
    toast.success(`ورود به عنوان ${t.name}`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-4"><Skeleton className="h-10 w-full" /></Card>
        <Card className="p-0"><Skeleton className="h-96 w-full" /></Card>
      </div>
    );
  }
  if (error || !data) {
    return <ErrorState message={error || "اطلاعات یافت نشد"} onReload={reload} />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، slug یا تلفن…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAN_FILTERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground self-center whitespace-nowrap px-2">
            {formatNumber(filtered.length)} از {formatNumber(data.length)}
          </div>
        </div>
      </Card>

      {/* Table */}
      <SectionCard title="کسب‌وکارها" description={`مجموع ${formatNumber(data.length)} کسب‌وکار`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>کسب‌وکار</TableHead>
              <TableHead>نوع</TableHead>
              <TableHead>پلن</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="text-left">گفتگو</TableHead>
              <TableHead className="text-left">لید</TableHead>
              <TableHead className="text-left">دانش</TableHead>
              <TableHead className="text-left">کاربر</TableHead>
              <TableHead className="text-left">MRR</TableHead>
              <TableHead className="text-left">عضویت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer"
                onClick={() => setSelected(t)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: t.accentColor }} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{t.slug}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{BUSINESS_TYPE_LABELS[t.businessType] || t.businessType}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px] font-mono">{t.plan?.code || "-"}</Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={t.status}
                    onValueChange={(v) => {
                      changeStatus(t, v);
                    }}
                  >
                    <SelectTrigger className="h-7 w-28 text-[11px] border-0 px-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTERS.filter((s) => s.value !== "all").map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-left text-xs font-mono">{formatNumber(t._count.conversations)}</TableCell>
                <TableCell className="text-left text-xs font-mono">{formatNumber(t._count.leads)}</TableCell>
                <TableCell className="text-left text-xs font-mono">{formatNumber(t._count.knowledge)}</TableCell>
                <TableCell className="text-left text-xs font-mono">{formatNumber(t._count.users)}</TableCell>
                <TableCell className="text-left text-xs font-mono">{formatToman(t.plan?.priceMonthly || 0)}</TableCell>
                <TableCell className="text-left text-xs text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
                  نتیجه‌ای یافت نشد
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: selected.accentColor }} />
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  {BUSINESS_TYPE_LABELS[selected.businessType]} • {selected.slug}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailItem icon={<Building2 className="size-3.5" />} label="پلن" value={selected.plan?.name || "-"} />
                <DetailItem icon={<Badge variant="outline" className="size-3.5 p-0" />} label="کد پلن" value={selected.plan?.code || "-"} />
                <DetailItem icon={<MessageSquare className="size-3.5" />} label="گفتگوها" value={formatNumber(selected._count.conversations)} />
                <DetailItem icon={<UserPlus className="size-3.5" />} label="لیدها" value={formatNumber(selected._count.leads)} />
                <DetailItem icon={<BookOpen className="size-3.5" />} label="دانش" value={formatNumber(selected._count.knowledge)} />
                <DetailItem icon={<Users className="size-3.5" />} label="کاربران" value={formatNumber(selected._count.users)} />
              </div>

              {selected.description && (
                <div className="text-sm text-muted-foreground border rounded-lg p-3 bg-muted/30">
                  {selected.description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                {selected.phone && <ContactItem icon={<Phone className="size-3" />} label={selected.phone} />}
                {selected.website && <ContactItem icon={<Globe className="size-3" />} label={selected.website} />}
                {selected.instagram && <ContactItem icon={<Instagram className="size-3" />} label={selected.instagram} />}
                <ContactItem label={"عضویت: " + formatDate(selected.createdAt)} />
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={actionLoading}
                  onClick={() => changeStatus(selected, selected.status === "suspended" ? "active" : "suspended")}
                >
                  {selected.status === "suspended" ? <><Play className="size-3.5" /> فعال‌سازی</> : <><Pause className="size-3.5" /> تعلیق</>}
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => impersonate(selected)}>
                  <LogIn className="size-3.5" />
                  ورود به عنوان
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/40">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">{icon}{label}</span>
      <span className="font-medium text-xs">{value}</span>
    </div>
  );
}

function ContactItem({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground truncate font-mono">
      {icon}{label}
    </span>
  );
}
