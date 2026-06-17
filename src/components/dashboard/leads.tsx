"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  UserPlus, Phone, Mail, Search, Download, Plus, Loader2, ExternalLink, MessageSquare,
} from "lucide-react";
import { api, type Lead } from "@/lib/api-client";
import { useApp } from "@/store/app-store";
import { toFa, formatToman, formatDate, LEAD_STATUS } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync, KpiCard } from "./shared";

const INTENT_LABELS: Record<string, string> = {
  inquiry: "استعلام",
  order: "سفارش",
  booking: "رزرو",
  appointment: "نوبت",
  callback: "تماس مجدد",
};

const SOURCE_LABELS: Record<string, string> = {
  chat: "گفتگو",
  voice: "صوتی",
  form: "فرم",
  referral: "معرفی",
  manual: "دستی",
};

export function LeadsTab({ tenantId }: { tenantId: string }) {
  const { setDashboardTab } = useApp();
  const { data, loading, error, reload } = useAsync<Lead[]>(() => api(`/api/leads?tenantId=${tenantId}`), [tenantId]);
  const [filter, setFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // New lead form
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [source, setSource] = React.useState("manual");
  const [intent, setIntent] = React.useState("inquiry");

  const resetForm = () => { setName(""); setPhone(""); setEmail(""); setSource("manual"); setIntent("inquiry"); };

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { toast.error("نام و تلفن الزامی است"); return; }
    setSubmitting(true);
    try {
      await api("/api/leads", {
        method: "POST",
        body: JSON.stringify({ tenantId, name: name.trim(), phone: phone.trim(), email: email.trim(), source, intent }),
      });
      toast.success("لید جدید اضافه شد.");
      resetForm();
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api(`/api/leads/${id}?tenantId=${tenantId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success("وضعیت به‌روزرسانی شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا");
    }
  };

  const exportCsv = () => {
    if (!data || data.length === 0) { toast.error("لیدی برای خروجی وجود ندارد"); return; }
    const rows = [
      ["نام", "تلفن", "ایمیل", "منبع", "نوع", "وضعیت", "ارزش (تومان)", "تاریخ"],
      ...data.map((l) => [
        l.name,
        l.phone,
        l.email || "",
        SOURCE_LABELS[l.source] || l.source,
        INTENT_LABELS[l.intent] || l.intent,
        LEAD_STATUS[l.status]?.label || l.status,
        String(l.value || 0),
        new Date(l.createdAt).toLocaleDateString("fa-IR"),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${tenantId}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("فایل CSV دانلود شد.");
  };

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const filtered = data.filter((l) => {
    if (filter !== "all" && l.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!(`${l.name} ${l.phone} ${l.email}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const totalValue = data.reduce((s, l) => s + (l.value || 0), 0);
  const newCount = data.filter((l) => l.status === "new").length;
  const convertedCount = data.filter((l) => l.status === "converted").length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={UserPlus} label="کل لیدها" value={toFa(data.length)} />
        <KpiCard icon={Phone} label="جدید" value={toFa(newCount)} accent="#3b82f6" />
        <KpiCard icon={MessageSquare} label="تبدیل شده" value={toFa(convertedCount)} accent="#10b981" />
        <KpiCard icon={Download} label="ارزش کل" value={formatToman(totalValue)} accent="#f59e0b" />
      </div>

      <SectionCard
        title="لیست لیدها"
        description={`${toFa(filtered.length)} لید`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="size-4" /> خروجی CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="size-4" /> افزودن لید</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>افزودن لید دستی</DialogTitle>
                  <DialogDescription>اطلاعات لید جدید را وارد کنید.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>نام *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام مشتری" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>تلفن *</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="۰۹۱۲…" dir="ltr" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>ایمیل</Label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" dir="ltr" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>منبع</Label>
                      <Select value={source} onValueChange={setSource}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>نوع درخواست</Label>
                      <Select value={intent} onValueChange={setIntent}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(INTENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
                  <Button onClick={submit} disabled={submitting} className="gap-1.5">
                    {submitting && <Loader2 className="size-4 animate-spin" />} افزودن
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی نام، تلفن یا ایمیل…" className="pr-8 h-9 text-sm" />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {Object.entries(LEAD_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={UserPlus} title="لیدی یافت نشد" description="فیلتر یا جستجوی خود را تغییر دهید." />
          ) : (
            <div className="max-h-[60vh] overflow-y-auto scroll-area -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>تماس</TableHead>
                    <TableHead className="hidden md:table-cell">منبع</TableHead>
                    <TableHead className="hidden lg:table-cell">نوع</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="hidden sm:table-cell">ارزش</TableHead>
                    <TableHead className="hidden xl:table-cell">تاریخ</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => {
                    const st = LEAD_STATUS[l.status] || LEAD_STATUS.new;
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{l.name}</div>
                          {l.email && <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="size-2.5" /> {l.email}</div>}
                        </TableCell>
                        <TableCell>
                          <a href={`tel:${l.phone}`} className="text-sm font-medium tabular-nums hover:text-primary flex items-center gap-1.5">
                            <Phone className="size-3 text-muted-foreground" /> {toFa(l.phone)}
                          </a>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{SOURCE_LABELS[l.source] || l.source}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{INTENT_LABELS[l.intent] || l.intent}</TableCell>
                        <TableCell>
                          <Select value={l.status} onValueChange={(v) => updateStatus(l.id, v)}>
                            <SelectTrigger className="h-7 w-32 text-[11px] gap-1" >
                              <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(LEAD_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs tabular-nums">{l.value > 0 ? formatToman(l.value) : "—"}</TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">{formatDate(l.createdAt)}</TableCell>
                        <TableCell>
                          {l.conversationId && (
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => setDashboardTab("conversations")} title="مشاهده گفتگو">
                              <ExternalLink className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
