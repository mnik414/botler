"use client";
import * as React from "react";
import { useAsync, ErrorState, SectionCard, StatCard, statusBadgeClass, statusLabel } from "./shared";
import { api } from "@/lib/api-client";
import { formatToman, formatNumber, formatDate, toFa } from "@/lib/format";
import { LEAD_STATUS } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, Phone, Mail, TrendingUp, CheckCircle2, Clock, XCircle } from "lucide-react";

interface AdminLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  intent: string;
  status: string;
  value: number;
  createdAt: string;
  tenant: { id: string; name: string; slug: string; accentColor: string };
}

const INTENT_LABELS: Record<string, string> = {
  inquiry: "استعلام",
  order: "سفارش",
  booking: "رزرو",
  appointment: "نوبت",
  callback: "درخواست تماس",
};

const SOURCE_LABELS: Record<string, string> = {
  chat: "گفتگو",
  voice: "تماس صوتی",
  form: "فرم",
  referral: "معرفی",
  manual: "دستی",
};

export function AdminLeads() {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const { data, loading, error, reload } = useAsync<AdminLead[]>(
    () => api(`/api/admin/leads?status=${statusFilter}&q=${encodeURIComponent(query)}`),
    [statusFilter, query]
  );

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

  const totalValue = data.reduce((s, l) => s + (l.value || 0), 0);
  const converted = data.filter((l) => l.status === "converted").length;
  const newLeads = data.filter((l) => l.status === "new").length;
  const conversionRate = data.length > 0 ? Math.round((converted / data.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="کل لیدها" value={formatNumber(data.length)} icon={<UserPlus className="size-4" />} accent="primary" />
        <StatCard label="لیدهای جدید" value={formatNumber(newLeads)} hint="نیازمند پیگیری" icon={<Clock className="size-4" />} accent="sky" />
        <StatCard label="تبدیل‌شده" value={formatNumber(converted)} hint={`نرخ تبدیل ${toFa(conversionRate)}٪`} icon={<CheckCircle2 className="size-4" />} accent="teal" />
        <StatCard label="ارزش کل" value={formatToman(totalValue)} icon={<TrendingUp className="size-4" />} accent="amber" />
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، تلفن یا ایمیل…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="new">جدید</SelectItem>
              <SelectItem value="contacted">در حال پیگیری</SelectItem>
              <SelectItem value="converted">تبدیل شده</SelectItem>
              <SelectItem value="lost">از دست رفته</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <SectionCard title="لیدهای جذب‌شده" description={`مجموع ${formatNumber(data.length)} لید در کل پلتفرم`}>
        <div className="max-h-[60vh] overflow-y-auto scroll-area">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام</TableHead>
                <TableHead>تماس</TableHead>
                <TableHead>کسب‌وکار</TableHead>
                <TableHead>منبع</TableHead>
                <TableHead>قصد</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="text-left">ارزش</TableHead>
                <TableHead className="text-left">تاریخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((l) => {
                const st = LEAD_STATUS[l.status] || { label: l.status, color: "" };
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{l.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="flex items-center gap-1 font-mono" dir="ltr">
                          <Phone className="size-3 text-muted-foreground" />{toFa(l.phone)}
                        </span>
                        {l.email && (
                          <span className="flex items-center gap-1 text-muted-foreground font-mono" dir="ltr">
                            <Mail className="size-3" />{l.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ background: l.tenant.accentColor }} />
                        <span className="text-xs truncate max-w-[120px]">{l.tenant.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{SOURCE_LABELS[l.source] || l.source}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{INTENT_LABELS[l.intent] || l.intent}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${st.color}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-left font-mono text-xs">{l.value ? formatToman(l.value) : "—"}</TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                    لیدی یافت نشد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
