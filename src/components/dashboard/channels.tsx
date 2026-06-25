"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Instagram, MessageCircle, Send, Globe, Phone, Check, Loader2, Plug, AlertCircle,
  Copy, ExternalLink, ChevronDown, ChevronUp, Settings2, Zap, Bot,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { toFa, formatDate, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, useAsync } from "./shared";

const ICON_MAP: Record<string, any> = {
  Instagram, MessageCircle, Send, Globe, Phone,
};

interface ChannelInfo {
  platform: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  setupSteps: string[];
  credentialsFields: { key: string; label: string; type: string; placeholder: string; required: boolean }[];
  connected: boolean;
  connection: any;
}

export function ChannelsTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<ChannelInfo[]>(() => api(`/api/channels?tenantId=${tenantId}`), [tenantId]);
  const [configChannel, setConfigChannel] = React.useState<ChannelInfo | null>(null);
  const [testingId, setTestingId] = React.useState<string | null>(null);

  const testChannel = async (conn: any) => {
    setTestingId(conn.id);
    try {
      const res = await api<{ ok: boolean; reply?: string; error?: string }>(`/api/channels/${conn.id}/test`, {
        method: "POST", body: JSON.stringify({ tenantId }),
      });
      if (res.ok) toast.success(`اتصال تأیید شد: ${res.reply || "OK"}`);
      else toast.error(`خطا: ${res.error}`);
      reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setTestingId(null); }
  };

  const toggleSetting = async (conn: any, field: string, value: boolean) => {
    try {
      await api(`/api/channels/${conn.id}?tenantId=${tenantId}`, {
        method: "PATCH", body: JSON.stringify({ [field]: value }),
      });
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const disconnect = async (conn: any) => {
    try {
      await api(`/api/channels/${conn.id}?tenantId=${tenantId}`, { method: "DELETE" });
      toast.success("کانال قطع شد.");
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const connectedCount = data.filter((c) => c.connected).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <SectionCard title="اتصال کانال‌ها" description={`${toFa(connectedCount)} از ${toFa(data.length)} کانال متصل`}>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-2">
          <div className="grid place-items-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
            <Bot className="size-4" />
          </div>
          <div className="text-xs leading-6 text-muted-foreground">
            منشی هوشمند شما می‌تواند به‌طور خودکار به پیام‌های دریافتی در <strong className="text-foreground">اینستاگرام</strong>،
            <strong className="text-foreground"> واتساپ</strong>، <strong className="text-foreground">تلگرام</strong> و
            <strong className="text-foreground"> وب‌سایت</strong> پاسخ دهد. هر کانال را متصل کنید تا منشی در آن پلتفرم فعال شود.
          </div>
        </div>
      </SectionCard>

      {/* Channel cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((ch) => {
          const Icon = ICON_MAP[ch.icon] || Globe;
          const conn = ch.connection;
          return (
            <Card key={ch.platform} className={`relative ${ch.connected ? "border-primary/40" : ""}`}>
              <CardContent className="pt-6 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid place-items-center size-10 rounded-xl" style={{ background: ch.color + "15", color: ch.color }}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{ch.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {ch.connected ? `${toFa(conn.messageCount)} پیام` : "متصل نیست"}
                      </div>
                    </div>
                  </div>
                  {ch.connected ? (
                    <Badge className="text-[10px] gap-0.5">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> متصل
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">غیرفعال</Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-[11px] text-muted-foreground leading-5 min-h-[2.5em]">{ch.description}</p>

                {/* Status info */}
                {ch.connected && conn && (
                  <div className="space-y-1 text-[10px] text-muted-foreground bg-muted/30 rounded-lg p-2">
                    {conn.handle && <div className="flex items-center justify-between"><span>آیدی:</span><span className="font-mono truncate max-w-[120px]" dir="ltr">{conn.handle}</span></div>}
                    {conn.lastMessageAt && <div className="flex items-center justify-between"><span>آخرین پیام:</span><span>{timeAgo(conn.lastMessageAt)}</span></div>}
                    {conn.lastTestOk === false && <div className="text-rose-600 flex items-center gap-1"><AlertCircle className="size-3" /> {conn.errorMessage?.slice(0, 50)}</div>}
                  </div>
                )}

                {/* Settings toggles */}
                {ch.connected && conn && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] cursor-pointer">پاسخ خودکار AI</Label>
                      <Switch checked={conn.autoReply} onCheckedChange={(v) => toggleSetting(conn, "autoReply", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] cursor-pointer">انتقال به اپراتور</Label>
                      <Switch checked={conn.handoffEnabled} onCheckedChange={(v) => toggleSetting(conn, "handoffEnabled", v)} />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {ch.connected ? (
                    <>
                      <Button variant="outline" size="sm" className="gap-1.5 flex-1" disabled={testingId === conn.id} onClick={() => testChannel(conn)}>
                        {testingId === conn.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                        تست
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setConfigChannel(ch)}>
                        <Settings2 className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => disconnect(conn)}>
                        قطع
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" className="gap-1.5 w-full" onClick={() => setConfigChannel(ch)}>
                      <Plug className="size-3.5" /> اتصال
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Config dialog */}
      {configChannel && (
        <ChannelConfigDialog
          channel={configChannel}
          tenantId={tenantId}
          onClose={() => setConfigChannel(null)}
          onSaved={() => { setConfigChannel(null); reload(); }}
        />
      )}
    </div>
  );
}

// ── Channel Configuration Dialog ──
function ChannelConfigDialog({ channel, tenantId, onClose, onSaved }: {
  channel: ChannelInfo; tenantId: string; onClose: () => void; onSaved: () => void;
}) {
  const [credentials, setCredentials] = React.useState<Record<string, string>>({});
  const [handle, setHandle] = React.useState(channel.connection?.handle || "");
  const [showSteps, setShowSteps] = React.useState(!channel.connected);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async () => {
    // Validate required fields
    for (const f of channel.credentialsFields) {
      if (f.required && !credentials[f.key]) {
        toast.error(`${f.label} الزامی است`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await api("/api/channels", {
        method: "POST",
        body: JSON.stringify({ tenantId, platform: channel.platform, credentials, handle }),
      });
      toast.success(`کانال ${channel.name} با موفقیت متصل شد.`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scroll-area">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="grid place-items-center size-7 rounded-lg" style={{ background: channel.color + "15", color: channel.color }}>
              {React.createElement(ICON_MAP[channel.icon] || Globe, { className: "size-4" })}
            </div>
            اتصال {channel.name}
          </DialogTitle>
          <DialogDescription>{channel.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Setup guide */}
          {channel.setupSteps.length > 0 && (
            <div className="rounded-lg border bg-muted/30">
              <button className="w-full flex items-center justify-between p-3 text-right" onClick={() => setShowSteps(!showSteps)}>
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <ExternalLink className="size-3.5" /> راهنمای راه‌اندازی ({toFa(channel.setupSteps.length)} مرحله)
                </span>
                {showSteps ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {showSteps && (
                <div className="px-3 pb-3 space-y-2">
                  {channel.setupSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-5">
                      <div className="grid place-items-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">{toFa(i + 1)}</div>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Webhook URL — always show (even before connecting) for Instagram/WhatsApp/Telegram */}
          {(channel.platform === "instagram" || channel.platform === "whatsapp" || channel.platform === "telegram") && (
            <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Label className="text-xs flex items-center gap-1.5">
                <AlertCircle className="size-3 text-primary" />
                Webhook URL — این آدرس را در پنل توسعه‌دهنده ثبت کنید
              </Label>
              {(() => {
                const webhookUrl = channel.connection?.webhookUrl || `${typeof window !== "undefined" ? window.location.origin : "https://your-platform.com"}/api/channels/webhook/${channel.platform}?tenantId=${tenantId}`;
                return (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-background rounded px-2 py-1.5 text-[10px] font-mono break-all border" dir="ltr">{webhookUrl}</code>
                    <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("کپی شد"); }}>
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                );
              })()}
              <div className="text-[10px] text-muted-foreground leading-4 mt-1">
                {channel.platform === "instagram" && "در Meta for Developers → اپ شما → Webhooks → Callback URL این آدرس را وارد کنید و Verify Token زیر را نیز وارد نمایید."}
                {channel.platform === "whatsapp" && "در Meta Business Manager → WhatsApp Business API → Webhook → Callback URL این آدرس را وارد کنید."}
                {channel.platform === "telegram" && "برای تلگرام نیازی به ثبت دستی نیست — سیستم به‌طور خودکار Webhook را تنظیم می‌کند. فقط Bot Token را وارد کنید."}
              </div>
              {/* Verify Token display for Instagram/WhatsApp */}
              {(channel.platform === "instagram" || channel.platform === "whatsapp") && (
                <div className="mt-2">
                  <Label className="text-[10px] text-muted-foreground">Verify Token (در پنل Meta وارد کنید)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-background rounded px-2 py-1 text-[10px] font-mono border" dir="ltr">
                      {credentials.verifyToken || channel.connection?.webhookSecret?.slice(0, 20) || "یک کلمه دلخواه وارد کنید و همین را در پنل Meta بزنید"}
                    </code>
                    <p className="text-[9px] text-muted-foreground leading-3 max-w-[150px]">Verify Token یک کلمه دلخواه است که هم در پنل Meta و هم در فیلد Verify Token بالا وارد می‌کنید تا تأیید شود.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Webhook URL for already-connected channels */}
          {channel.connected && channel.connection?.webhookUrl && (channel.platform === "voice") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded px-2 py-1.5 text-[10px] font-mono break-all" dir="ltr">{channel.connection.webhookUrl}</code>
                <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => { navigator.clipboard.writeText(channel.connection.webhookUrl); toast.success("کپی شد"); }}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Handle */}
          {channel.platform === "telegram" && (
            <div className="space-y-1.5">
              <Label className="text-xs">یوزرنیم ربات (اختیاری)</Label>
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@my_business_bot" dir="ltr" />
            </div>
          )}
          {channel.platform === "instagram" && (
            <div className="space-y-1.5">
              <Label className="text-xs">یوزرنیم اینستاگرام</Label>
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@my_business" dir="ltr" />
            </div>
          )}
          {channel.platform === "whatsapp" && (
            <div className="space-y-1.5">
              <Label className="text-xs">شماره واتساپ</Label>
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="+98912..." dir="ltr" />
            </div>
          )}

          {/* Credentials */}
          {channel.credentialsFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
              <Input
                type={f.type === "password" ? "password" : "text"}
                value={credentials[f.key] || ""}
                onChange={(e) => setCredentials((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                dir="ltr"
                className="font-mono text-left"
              />
            </div>
          ))}

          {/* Widget embed code */}
          {channel.platform === "widget" && (
            <div className="space-y-1.5">
              <Label className="text-xs">کد امبد ویجت</Label>
              <pre className="bg-muted rounded-lg p-3 text-[10px] overflow-x-auto scroll-area" dir="ltr">
{`<script src="${typeof window !== "undefined" ? window.location.origin : "https://your-platform.com"}/widget.js"></script>
<script>
  AIReceptionist.init({ tenantId: "${tenantId}" });
</script>`}
              </pre>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { navigator.clipboard.writeText(`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js"></script>\n<script>AIReceptionist.init({tenantId:"${tenantId}"});</script>`); toast.success("کد کپی شد"); }}>
                <Copy className="size-3.5" /> کپی کد
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          {channel.credentialsFields.length > 0 && (
            <Button onClick={submit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />}
              {channel.connected ? "به‌روزرسانی اتصال" : "اتصال"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
