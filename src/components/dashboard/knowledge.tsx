"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  BookOpen, Plus, Trash2, FileText, FileQuestion, Globe, FileSpreadsheet, FileCode,
  Upload, Scissors, Brain, Database, Loader2, type LucideIcon,
} from "lucide-react";
import { api, type KnowledgeItem } from "@/lib/api-client";
import { toFa, formatNumber, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync, KpiCard } from "./shared";

const TYPE_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  faq: { label: "سوال متداول", icon: FileQuestion, color: "#10b981" },
  pdf: { label: "PDF", icon: FileText, color: "#ef4444" },
  docx: { label: "Word", icon: FileText, color: "#2563eb" },
  excel: { label: "Excel", icon: FileSpreadsheet, color: "#16a34a" },
  csv: { label: "CSV", icon: FileSpreadsheet, color: "#f59e0b" },
  website: { label: "وب‌سایت", icon: Globe, color: "#06b6d4" },
  text: { label: "متن", icon: FileCode, color: "#8b5cf6" },
};

function formatBytes(n: number) {
  if (n < 1024) return `${toFa(n)} بایت`;
  if (n < 1024 * 1024) return `${toFa((n / 1024).toFixed(1))} KB`;
  return `${toFa((n / (1024 * 1024)).toFixed(1))} MB`;
}

function PipelineStep({ icon: Icon, label, color }: { icon: LucideIcon; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center flex-1">
      <div className="grid place-items-center size-10 rounded-xl text-white" style={{ background: color }}>
        <Icon className="size-5" />
      </div>
      <div className="text-[11px] font-medium">{label}</div>
    </div>
  );
}

export function KnowledgeTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<KnowledgeItem[]>(() => api(`/api/knowledge?tenantId=${tenantId}`), [tenantId]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [type, setType] = React.useState<string>("faq");
  const [title, setTitle] = React.useState("");
  const [question, setQuestion] = React.useState("");
  const [content, setContent] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setType("faq"); setTitle(""); setQuestion(""); setContent(""); setUrl(""); setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isFileType = type === "pdf" || type === "docx" || type === "excel" || type === "csv";

  const submit = async () => {
    if (!title.trim()) { toast.error("عنوان الزامی است"); return; }
    if (type === "faq" && !question.trim()) { toast.error("سوال الزامی است"); return; }
    if (type === "website" && !url.trim()) { toast.error("آدرس سایت الزامی است"); return; }
    if (isFileType && !file) { toast.error("فایل مورد نظر را انتخاب کنید"); return; }
    if (!isFileType && type !== "faq" && type !== "website" && !content.trim()) { toast.error("محتوا الزامی است"); return; }

    setSubmitting(true);
    try {
      if (isFileType && file) {
        // Real file upload with multipart parsing
        const formData = new FormData();
        formData.append("tenantId", tenantId);
        formData.append("file", file);
        formData.append("title", title.trim());
        formData.append("type", type);
        const res = await fetch("/api/knowledge/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "خطا در آپلود" }));
          throw new Error(err.error);
        }
      } else {
        await api("/api/knowledge", {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            type,
            title: title.trim(),
            content: type === "faq" ? content.trim() : content.trim() || url.trim(),
            question: type === "faq" ? question.trim() : undefined,
            url: type === "website" ? url.trim() : undefined,
          }),
        });
      }
      toast.success("دانش جدید با موفقیت اضافه شد و پردازش شد.");
      resetForm();
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا در افزودن دانش");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await api(`/api/knowledge/${id}?tenantId=${tenantId}`, { method: "DELETE" });
      toast.success("حذف شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const items = data;
  const totalSize = items.reduce((s, i) => s + (i.size || 0), 0);
  const byType: Record<string, number> = {};
  for (const i of items) byType[i.type] = (byType[i.type] || 0) + 1;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={BookOpen} label="کل منابع دانش" value={formatNumber(items.length)} />
        <KpiCard icon={Database} label="حجم کل" value={formatBytes(totalSize)} accent="#06b6d4" />
        <KpiCard icon={FileQuestion} label="سوالات متداول" value={formatNumber(byType.faq || 0)} accent="#10b981" />
        <KpiCard icon={FileText} label="اسناد متنی" value={formatNumber((byType.pdf || 0) + (byType.docx || 0) + (byType.text || 0))} accent="#8b5cf6" />
      </div>

      {/* Pipeline explainer */}
      <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
        <CardContent className="pt-6">
          <div className="text-sm font-semibold mb-1">پایپ‌لاین پردازش دانش</div>
          <p className="text-xs text-muted-foreground mb-4">پس از افزودن، سیستم خودکار پردازش زیر را انجام می‌دهد:</p>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <PipelineStep icon={Upload} label="بارگذاری" color="#10b981" />
            <div className="text-muted-foreground hidden sm:block">→</div>
            <PipelineStep icon={Scissors} label="تقسیم (Chunking)" color="#f59e0b" />
            <div className="text-muted-foreground hidden sm:block">→</div>
            <PipelineStep icon={Brain} label="تعبیه‌سازی (Embedding)" color="#8b5cf6" />
            <div className="text-muted-foreground hidden sm:block">→</div>
            <PipelineStep icon={Database} label="ذخیره در Vector DB" color="#06b6d4" />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <SectionCard
        title="منابع دانش"
        description="مدیریت دانش منشی هوشمند"
        action={
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="size-4" /> افزودن دانش</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>افزودن دانش جدید</DialogTitle>
                <DialogDescription>دانش جدید به پایگاه دانش اضافه و بلافاصله پردازش می‌شود.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto scroll-area pl-1">
                <div className="space-y-1.5">
                  <Label>نوع دانش</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_META).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>عنوان</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: سوالات متداول درباره ارسال" />
                </div>
                {type === "faq" && (
                  <div className="space-y-1.5">
                    <Label>سوال</Label>
                    <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="سوال مشتری…" />
                  </div>
                )}
                {type === "website" ? (
                  <div className="space-y-1.5">
                    <Label>آدرس وب‌سایت</Label>
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" dir="ltr" />
                  </div>
                ) : isFileType ? (
                  <div className="space-y-1.5">
                    <Label>فایل {TYPE_META[type]?.label}</Label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-accent/50 transition"
                    >
                      <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
                      {file ? (
                        <div className="text-sm">
                          <div className="font-medium text-emerald-600">{file.name}</div>
                          <div className="text-xs text-muted-foreground">{formatBytes(file.size)} — برای تغییر کلیک کنید</div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          کلیک کنید و فایل را انتخاب کنید
                          <div className="text-xs mt-1">
                            {type === "pdf" && ".pdf"}
                            {type === "docx" && ".docx"}
                            {type === "excel" && ".xlsx, .xls"}
                            {type === "csv" && ".csv"}
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept={
                          type === "pdf" ? ".pdf" :
                          type === "docx" ? ".docx" :
                          type === "excel" ? ".xlsx,.xls" :
                          type === "csv" ? ".csv" : "*"
                        }
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); } }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">پس از آپلود، فایل به‌طور خودکار پردازش، تقطیع (Chunk) و Embedding می‌شود.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>{type === "faq" ? "پاسخ" : "محتوا"}</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={6}
                      placeholder="متن کامل محتوا یا پاسخ به سوال…"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
                <Button onClick={submit} disabled={submitting} className="gap-1.5">
                  {submitting && <Loader2 className="size-4 animate-spin" />} افزودن
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="هنوز دانشی ثبت نشده"
            description="برای اینکه منشی هوشمند بتواند به سوالات مشتریان پاسخ دقیق بدهد، دانش کسب‌وکار خود را اضافه کنید."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>عنوان</TableHead>
                <TableHead className="w-32">نوع</TableHead>
                <TableHead className="w-28 hidden md:table-cell">حجم</TableHead>
                <TableHead className="w-32 hidden sm:table-cell">تاریخ</TableHead>
                <TableHead className="w-24">وضعیت</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => {
                const meta = TYPE_META[it.type] || TYPE_META.text;
                return (
                  <TableRow key={it.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="grid place-items-center size-8 rounded-lg text-white shrink-0" style={{ background: meta.color }}>
                          <meta.icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate max-w-[260px]">{it.title}</div>
                          {(it.question || it.url) && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">{it.question || it.url}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{meta.label}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums text-xs text-muted-foreground">{formatBytes(it.size)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{formatDate(it.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">{it.status === "ready" ? "آماده" : it.status === "processing" ? "در حال پردازش" : it.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        disabled={deletingId === it.id}
                        onClick={() => remove(it.id)}
                      >
                        {deletingId === it.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
