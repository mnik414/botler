"use client";
import * as React from "react";
import { useAsync, ErrorState, SectionCard, StatCard } from "./shared";
import { api } from "@/lib/api-client";
import { formatToman, formatNumber, formatDate, toFa } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Receipt, CheckCircle2, Clock, XCircle, Wallet } from "lucide-react";

interface AdminInvoice {
  id: string;
  amount: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  tenant: { id: string; name: string; slug: string; accentColor: string };
  plan: { id: string; name: string; code: string; priceMonthly: number } | null;
}

const INVOICE_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  paid: { label: "پرداخت‌شده", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  pending: { label: "در انتظار", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock },
  failed: { label: "ناموفق", color: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle },
};

export function AdminPayments() {
  const [statusFilter, setStatusFilter] = React.useState("all");
  const { data, loading, error, reload } = useAsync<AdminInvoice[]>(
    () => api(`/api/admin/invoices?status=${statusFilter}`),
    [statusFilter]
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

  const totalPaid = data.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalPending = data.filter((i) => i.status === "pending").reduce((s, i) => s + i.amount, 0);
  const totalFailed = data.filter((i) => i.status === "failed").reduce((s, i) => s + i.amount, 0);
  const paidCount = data.filter((i) => i.status === "paid").length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="درآمد جمع‌شده" value={formatToman(totalPaid)} hint={`${formatNumber(paidCount)} صورتحساب پرداخت‌شده`} icon={<Wallet className="size-4" />} accent="primary" />
        <StatCard label="در انتظار پرداخت" value={formatToman(totalPending)} hint="نیازمند پیگیری" icon={<Clock className="size-4" />} accent="amber" />
        <StatCard label="ناموفق" value={formatToman(totalFailed)} hint="پرداخت‌های ناموفق" icon={<XCircle className="size-4" />} accent="pink" />
        <StatCard label="کل صورتحساب‌ها" value={formatNumber(data.length)} icon={<Receipt className="size-4" />} accent="teal" />
      </div>

      {/* Filter */}
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">فیلتر وضعیت:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="paid">پرداخت‌شده</SelectItem>
              <SelectItem value="pending">در انتظار</SelectItem>
              <SelectItem value="failed">ناموفق</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <SectionCard title="صورتحساب‌ها و پرداخت‌ها" description={`مجموع ${formatNumber(data.length)} صورتحساب`}>
        <div className="max-h-[60vh] overflow-y-auto scroll-area">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>کسب‌وکار</TableHead>
                <TableHead>پلن</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="text-left">مبلغ</TableHead>
                <TableHead className="text-left">دوره</TableHead>
                <TableHead className="text-left">تاریخ صدور</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((inv) => {
                const st = INVOICE_STATUS[inv.status] || { label: inv.status, color: "", icon: Receipt };
                return (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: inv.tenant.accentColor }} />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{inv.tenant.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{inv.tenant.slug}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-mono">{inv.plan?.code || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${st.color}`}>
                        <st.icon className="size-3" />
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-left font-mono text-xs font-bold">{formatToman(inv.amount)}</TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">
                      {formatDate(inv.periodStart)} <br />
                      <span className="text-[10px]">تا {formatDate(inv.periodEnd)}</span>
                    </TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">{formatDate(inv.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    صورتحسابی یافت نشد
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
