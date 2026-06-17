"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, UserCog, Crown, Plus, Trash2, Loader2, Mail, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { toFa, formatDate, ROLE_LABELS } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync, KpiCard } from "./shared";

interface OperatorUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  avatarUrl?: string | null;
}

const ROLE_BADGE: Record<string, { color: string }> = {
  business_owner: { color: "bg-primary/15 text-primary border-primary/30" },
  operator: { color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  super_admin: { color: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
};

export function OperatorsTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<OperatorUser[]>(
    () => api(`/api/tenants/${tenantId}/operators`),
    [tenantId],
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Add-operator form
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
  };

  const submit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("نام، ایمیل و گذرواژه الزامی است");
      return;
    }
    if (password.length < 4) {
      toast.error("گذرواژه باید حداقل ۴ کاراکتر باشد");
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/tenants/${tenantId}/operators`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          role: "operator",
        }),
      });
      toast.success("اپراتور جدید اضافه شد.");
      resetForm();
      setDialogOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا در افزودن اپراتور");
    } finally {
      setSubmitting(false);
    }
  };

  const removeUser = async (u: OperatorUser) => {
    setDeletingId(u.id);
    try {
      await api(`/api/tenants/${tenantId}/operators?userId=${u.id}`, { method: "DELETE" });
      toast.success("کاربر حذف شد.");
      reload();
    } catch (e: any) {
      toast.error(e.message || "خطا در حذف کاربر");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const users = data;
  const operatorsCount = users.filter((u) => u.role === "operator").length;
  const ownersCount = users.filter((u) => u.role === "business_owner").length;
  const canDeleteOwner = ownersCount >= 2;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="کل کاربران" value={toFa(users.length)} />
        <KpiCard icon={UserCog} label="اپراتورها" value={toFa(operatorsCount)} accent="#f59e0b" />
        <KpiCard icon={Crown} label="صاحبان کسب‌وکار" value={toFa(ownersCount)} accent="#10b981" />
        <KpiCard
          icon={ShieldCheck}
          label="آخرین عضو"
          value={users.length > 0 ? formatDate(users[users.length - 1].createdAt) : "—"}
          hint={users.length > 0 ? users[users.length - 1].name : undefined}
        />
      </div>

      {/* List */}
      <SectionCard
        title="مدیریت اپراتورها"
        description="کاربران دسترسی‌دار به پنل این کسب‌وکار"
        action={
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" /> افزودن اپراتور
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>افزودن اپراتور جدید</DialogTitle>
                <DialogDescription>
                  اپراتور جدید می‌تواند گفتگوهای منتقل‌شده را پاسخ دهد و لیدها را مدیریت کند.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>نام کامل *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="نام اپراتور"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ایمیل *</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@example.com"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>گذرواژه *</Label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر"
                    dir="ltr"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  اپراتور با ایمیل و گذرواژه بالا می‌تواند وارد پنل اپراتور شود.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>انصراف</Button>
                <Button onClick={submit} disabled={submitting} className="gap-1.5">
                  {submitting && <Loader2 className="size-4 animate-spin" />} افزودن اپراتور
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="هنوز کاربری ثبت نشده"
            description="با افزودن اپراتور، کمک‌گرفتن از تیم خود در پاسخ‌گویی به مشتریان را آغاز کنید."
          />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto scroll-area -mx-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کاربر</TableHead>
                  <TableHead className="hidden md:table-cell">ایمیل</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead className="hidden sm:table-cell">تاریخ عضویت</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isOwner = u.role === "business_owner";
                  const disabled = isOwner && !canDeleteOwner;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9 border">
                            <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                              {u.name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate flex items-center gap-1.5">
                              {u.name}
                              {isOwner && <Crown className="size-3 text-primary" />}
                            </div>
                            <div className="text-[11px] text-muted-foreground md:hidden flex items-center gap-1 truncate">
                              <Mail className="size-2.5" /> {u.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5 tabular-nums" dir="ltr">
                          <Mail className="size-3 shrink-0" /> {u.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${ROLE_BADGE[u.role]?.color || ""}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={disabled || deletingId === u.id}
                          onClick={() => removeUser(u)}
                          title={disabled ? "نمی‌توان آخرین صاحب کسب‌وکار را حذف کرد" : "حذف کاربر"}
                        >
                          {deletingId === u.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
