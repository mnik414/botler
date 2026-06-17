"use client";
import * as React from "react";
import { useApp } from "@/store/app-store";
import { api, type MarketplaceItem } from "@/lib/api-client";
import { toFa, formatDate, timeAgo, formatToman, CONVO_STATUS, LEAD_STATUS } from "@/lib/format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Phone, MessageSquare, UserPlus, CalendarCheck, Package, Clock, Loader2, Inbox,
} from "lucide-react";

/* ───────────────────────────── Types ───────────────────────────── */
interface TrackConversation {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  channel: string;
}
interface TrackLead {
  id: string;
  name: string;
  intent: string;
  status: string;
  value: number;
  createdAt: string;
}
interface TrackBookingPayload {
  details?: string;
  label?: string;
  endUserName?: string;
  endUserPhone?: string;
  capturedAt?: string;
}
interface TrackBooking {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  scheduledAt?: string | null;
  payload: TrackBookingPayload;
}
interface TrackResponse {
  found: boolean;
  conversations: TrackConversation[];
  leads: TrackLead[];
  bookings: TrackBooking[];
}

/* ───────────────────────────── Label maps ───────────────────────────── */
const CHANNEL_LABELS: Record<string, string> = {
  website: "وب‌سایت",
  widget: "ویجت",
  instagram: "اینستاگرام",
  whatsapp: "واتساپ",
  voice: "تماس صوتی",
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  order: "سفارش",
  reservation: "رزرو",
  appointment: "نوبت",
  callback: "تماس مجدد",
};

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  confirmed: { label: "تأیید شده", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  cancelled: { label: "لغو شده", color: "bg-rose-500/15 text-rose-600 border-rose-500/30" },
};

const INTENT_LABELS: Record<string, string> = {
  inquiry: "استعلام",
  order: "سفارش",
  booking: "رزرو",
  appointment: "نوبت",
  callback: "تماس مجدد",
};

/* ───────────────────────────── Page ───────────────────────────── */
export function TrackRequestPage() {
  const { activeTenantId } = useApp();
  const [tenants, setTenants] = React.useState<MarketplaceItem[]>([]);
  const [tenantsLoading, setTenantsLoading] = React.useState(true);

  const [phone, setPhone] = React.useState("");
  const [tenantId, setTenantId] = React.useState<string>(activeTenantId || "");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<TrackResponse | null>(null);
  const [searched, setSearched] = React.useState(false);

  // Pre-select active tenant from store
  React.useEffect(() => {
    if (activeTenantId) setTenantId(activeTenantId);
  }, [activeTenantId]);

  // Fetch tenant list only when no pre-selected tenant
  React.useEffect(() => {
    if (activeTenantId) {
      setTenantsLoading(false);
      return;
    }
    let mounted = true;
    setTenantsLoading(true);
    api<MarketplaceItem[]>("/api/marketplace")
      .then((d) => mounted && (setTenants(d), setTenantId((prev) => prev || (d[0]?.id ?? ""))))
      .catch(() => mounted && setTenants([]))
      .finally(() => mounted && setTenantsLoading(false));
    return () => {
      mounted = false;
    };
  }, [activeTenantId]);

  const activeTenant = tenants.find((t) => t.id === tenantId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      toast.error("شماره تلفن را وارد کنید");
      return;
    }
    if (!tenantId) {
      toast.error("یک کسب‌وکار را انتخاب کنید");
      return;
    }
    setSubmitting(true);
    setResult(null);
    setSearched(false);
    try {
      const url = `/api/track?phone=${encodeURIComponent(cleanPhone)}&tenantId=${encodeURIComponent(tenantId)}`;
      const data = await api<TrackResponse>(url);
      setResult(data);
      setSearched(true);
      if (!data.found) {
        toast.info("درخواستی با این شماره یافت نشد");
      } else {
        toast.success(
          `${toFa(data.conversations.length)} گفتگو، ${toFa(data.leads.length)} لید، ${toFa(data.bookings.length)} رزرو یافت شد`
        );
      }
    } catch (e: any) {
      toast.error(e.message || "خطا در جستجو");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <Badge variant="secondary" className="mb-3 gap-1.5">
          <Search className="size-3.5" />
          پیگیری درخواست
        </Badge>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">
          پیگیری درخواست‌های شما
        </h1>
        <p className="text-muted-foreground mt-3 leading-7 text-sm md:text-base">
          با وارد کردن شماره تلفن همراه خود، می‌توانید تمام گفتگوها، لیدها و رزروهای ثبت‌شده
          نزد کسب‌وکار موردنظر را پیگیری کنید.
        </p>
      </div>

      {/* Search form */}
      <Card className="border-primary/20 shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> شماره تلفن همراه
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912..."
                  dir="ltr"
                  inputMode="tel"
                  className="text-left tabular-nums"
                  autoComplete="tel"
                />
                <p className="text-[11px] text-muted-foreground">شماره‌ای که هنگام گفتگو ثبت کرده‌اید را وارد کنید.</p>
              </div>

              {/* Tenant */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Package className="size-3.5" /> کسب‌وکار
                </Label>
                {activeTenantId && activeTenant ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/40">
                    <span
                      className="grid place-items-center size-5 rounded text-white text-[10px] font-bold"
                      style={{ background: activeTenant.accentColor }}
                    >
                      {activeTenant.name.charAt(0)}
                    </span>
                    <span className="text-sm font-medium truncate">{activeTenant.name}</span>
                  </div>
                ) : tenantsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={tenantId} onValueChange={setTenantId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="یک کسب‌وکار را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ background: t.accentColor }}
                            />
                            {t.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[11px] text-muted-foreground">کسب‌وکاری که با منشی آن گفتگو کرده‌اید.</p>
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full gap-2">
              {submitting ? (
                <><Loader2 className="size-4 animate-spin" /> در حال جستجو…</>
              ) : (
                <><Search className="size-4" /> پیگیری درخواست</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results */}
      {submitting && <ResultsSkeleton />}

      {!submitting && searched && result && !result.found && (
        <Card className="mt-6 border-dashed">
          <CardContent className="pt-10 pb-10">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="grid place-items-center size-14 rounded-2xl bg-muted text-muted-foreground">
                <Inbox className="size-7" />
              </div>
              <div className="font-semibold">درخواستی با این شماره یافت نشد</div>
              <p className="text-sm text-muted-foreground max-w-md">
                مطمئن شوید شماره را با کد ۰۹۱۲ وارد کرده‌اید و کسب‌وکار درست را انتخاب نموده‌اید.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!submitting && result && result.found && (
        <div className="mt-6 space-y-6">
          {/* Conversations */}
          {result.conversations.length > 0 && (
            <ResultSection
              icon={MessageSquare}
              title="گفتگوها"
              count={result.conversations.length}
            >
              <div className="space-y-3 max-h-96 overflow-y-auto scroll-area pl-1">
                {result.conversations.map((c) => {
                  const st = CONVO_STATUS[c.status] || CONVO_STATUS.ai;
                  return (
                    <Card key={c.id} className="border-border/70">
                      <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
                            <MessageSquare className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {CHANNEL_LABELS[c.channel] || c.channel}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Clock className="size-3" />
                              {timeAgo(c.updatedAt)}
                              <span className="mx-1">•</span>
                              {toFa(c.messageCount)} پیام
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                          {st.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ResultSection>
          )}

          {/* Leads */}
          {result.leads.length > 0 && (
            <ResultSection
              icon={UserPlus}
              title="لیدها"
              count={result.leads.length}
            >
              <div className="space-y-3 max-h-96 overflow-y-auto scroll-area pl-1">
                {result.leads.map((l) => {
                  const st = LEAD_STATUS[l.status] || LEAD_STATUS.new;
                  return (
                    <Card key={l.id} className="border-border/70">
                      <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid place-items-center size-9 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                            <UserPlus className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{l.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{INTENT_LABELS[l.intent] || l.intent}</span>
                              {l.value > 0 && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span className="tabular-nums">{formatToman(l.value)}</span>
                                </>
                              )}
                              <span className="mx-1">•</span>
                              <span>{formatDate(l.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                          {st.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ResultSection>
          )}

          {/* Bookings */}
          {result.bookings.length > 0 && (
            <ResultSection
              icon={CalendarCheck}
              title="رزرو و سفارش‌ها"
              count={result.bookings.length}
            >
              <div className="space-y-3 max-h-96 overflow-y-auto scroll-area pl-1">
                {result.bookings.map((b) => {
                  const st = BOOKING_STATUS[b.status] || BOOKING_STATUS.pending;
                  const label = b.payload?.label || BOOKING_TYPE_LABELS[b.type] || b.type;
                  return (
                    <Card key={b.id} className="border-border/70">
                      <CardContent className="py-3 px-4 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid place-items-center size-9 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                            <CalendarCheck className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">
                              {label}
                              <span className="text-muted-foreground text-[11px] mx-1.5">•</span>
                              <span className="text-[11px] text-muted-foreground">
                                {BOOKING_TYPE_LABELS[b.type] || b.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span>{formatDate(b.createdAt)}</span>
                              {b.scheduledAt && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="size-3" /> {formatDate(b.scheduledAt)}
                                  </span>
                                </>
                              )}
                              {b.payload?.endUserName && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{b.payload.endUserName}</span>
                                </>
                              )}
                            </div>
                            {b.payload?.details && (
                              <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                {b.payload.details}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                          {st.label}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ResultSection>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Helpers ───────────────────────────── */
function ResultSection({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="grid place-items-center size-7 rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        <Badge variant="secondary" className="tabular-nums">{toFa(count)} مورد</Badge>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
