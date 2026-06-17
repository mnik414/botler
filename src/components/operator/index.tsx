"use client";
import * as React from "react";
import { useApp } from "@/store/app-store";
import { api, type Conversation } from "@/lib/api-client";
import type { ChatMessage, RagSource } from "@/lib/types";
import { toFa, timeAgo, formatDate, formatNumber, CONVO_STATUS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Search, Send, LogOut, Headphones, MessageSquare, Phone, Globe, Instagram,
  CheckCircle2, AlertTriangle, Sparkles, User, Bot, ShieldAlert, Check, FileText, ChevronRight, UserPlus,
} from "lucide-react";

interface ConvMessage extends ChatMessage {
  id: string;
}

type FilterKey = "all" | "handoff" | "ai" | "closed";

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "handoff", label: "ارجاع‌شده" },
  { value: "ai", label: "هوش مصنوعی" },
  { value: "closed", label: "بسته‌شده" },
];

export function OperatorView() {
  const { session, logout } = useApp();
  const tenantId = session?.tenant?.id || "";

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ConvMessage[]>([]);
  const [loadingMsg, setLoadingMsg] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [online, setOnline] = React.useState(true);
  const [answered, setAnswered] = React.useState<Record<string, boolean>>({});
  const [handledToday, setHandledToday] = React.useState(0);

  const tenantName = session?.tenant?.name || "کسب‌وکار";

  // Load conversation list
  const loadConversations = React.useCallback(async () => {
    if (!tenantId) return;
    setLoadingList(true);
    setListError(null);
    try {
      const data = await api<Conversation[]>(`/api/conversations?tenantId=${tenantId}`);
      setConversations(data);
    } catch (e: any) {
      setListError(e?.message || "خطا در دریافت گفتگوها");
      toast.error("خطا در دریافت لیست گفتگوها");
    } finally {
      setLoadingList(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Filtered + sorted list (handoff first, then recent)
  const filtered = React.useMemo(() => {
    let list = [...conversations];
    if (filter !== "all") {
      list = list.filter((c) => c.status === filter);
    }
    if (query) {
      const q = query.trim();
      list = list.filter(
        (c) => c.endUserName?.includes(q) || c.endUserPhone?.includes(q)
      );
    }
    // Sort: handoff first, then updatedAt desc
    list.sort((a, b) => {
      if (a.status === "handoff" && b.status !== "handoff") return -1;
      if (b.status === "handoff" && a.status !== "handoff") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return list;
  }, [conversations, filter, query]);

  // Stats
  const stats = React.useMemo(() => {
    const queued = conversations.filter((c) => c.status === "handoff").length;
    const avgConf =
      conversations.length > 0
        ? conversations.reduce((s, c) => s + (c.confidence || 0), 0) / conversations.length
        : 0;
    return { queued, avgConf, handledToday };
  }, [conversations, handledToday]);

  // Load messages when selecting
  React.useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    setLoadingMsg(true);
    api<ConvMessage[]>(`/api/conversations/${selectedId}/messages`)
      .then((m) => {
        if (active) setMessages(m);
      })
      .catch((e: any) => {
        if (active) toast.error(e?.message || "خطا در دریافت پیام‌ها");
      })
      .finally(() => {
        if (active) setLoadingMsg(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  // Auto-scroll to bottom on new messages
  const msgScrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    msgScrollRef.current?.scrollTo({ top: msgScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, loadingMsg]);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  async function sendReply() {
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    // Optimistic add
    const tempId = "tmp-" + Date.now();
    const optimistic: ConvMessage = {
      id: tempId,
      role: "operator",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setReply("");
    try {
      await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId, content: text, operatorName: session?.name }),
      });
      setAnswered((a) => ({ ...a, [selectedId]: true }));
      setHandledToday((n) => n + 1);
      toast.success("پاسخ ارسال شد");
      // Refresh list to update counts
      loadConversations();
    } catch (e: any) {
      toast.error(e?.message || "خطا در ارسال پاسخ");
      setMessages((m) => m.filter((x) => x.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  function markAnswered() {
    if (!selectedId) return;
    setAnswered((a) => ({ ...a, [selectedId]: !a[selectedId] }));
    toast.success(answered[selectedId] ? "علامت‌گذاری برداشته شد" : "به‌عنوان پاسخ‌داده‌شده علامت‌گذاری شد");
  }

  // Guard
  if (!session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid place-items-center size-16 rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold mb-1">دسترسی غیرمجاز</h1>
            <p className="text-sm text-muted-foreground">برای ورود به پنل اپراتور ابتدا وارد شوید.</p>
          </div>
          <Button variant="destructive" onClick={logout} className="gap-1.5">
            <LogOut className="size-4" />
            خروج
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center size-9 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Headphones className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">{tenantName}</h1>
              <p className="text-[11px] text-muted-foreground">پنل اپراتور</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats badges */}
            <div className="hidden sm:flex items-center gap-2">
              <StatChip icon={<AlertTriangle className="size-3.5" />} label="در انتظار" value={toFa(stats.queued)} color="text-amber-600 bg-amber-500/10" />
              <StatChip icon={<CheckCircle2 className="size-3.5" />} label="پاسخ‌داده امروز" value={toFa(stats.handledToday)} color="text-emerald-600 bg-emerald-500/10" />
              <StatChip icon={<Sparkles className="size-3.5" />} label="میانگین اطمینان" value={toFa((stats.avgConf * 100).toFixed(0)) + "٪"} color="text-violet-600 bg-violet-500/10" />
            </div>

            {/* Online toggle */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOnline((o) => !o)}
            >
              <span className={`size-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
              <span className="text-xs">{online ? "آنلاین" : "آفلاین"}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/15 text-primary text-xs">
                      {session.name?.[0] || "O"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{session.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{session.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive gap-2">
                  <LogOut className="size-4" />
                  خروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile stats */}
        <div className="sm:hidden flex items-center gap-2 px-4 pb-2 overflow-x-auto">
          <StatChip icon={<AlertTriangle className="size-3.5" />} label="انتظار" value={toFa(stats.queued)} color="text-amber-600 bg-amber-500/10" />
          <StatChip icon={<CheckCircle2 className="size-3.5" />} label="امروز" value={toFa(stats.handledToday)} color="text-emerald-600 bg-emerald-500/10" />
          <StatChip icon={<Sparkles className="size-3.5" />} label="اطمینان" value={toFa((stats.avgConf * 100).toFixed(0)) + "٪"} color="text-violet-600 bg-violet-500/10" />
        </div>
      </header>

      {/* Main: queue + conversation */}
      <div className="flex-1 flex min-h-0">
        {/* Conversation queue (left) */}
        <aside className={`w-full md:w-80 lg:w-96 border-l bg-background flex-col shrink-0 ${selectedId ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="جستجو نام یا تلفن…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto scroll-area max-h-[60vh] md:max-h-none">
            {loadingList ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : listError ? (
              <div className="p-3">
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>خطا</AlertTitle>
                  <AlertDescription>{listError}</AlertDescription>
                </Alert>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="size-8 mx-auto mb-2 opacity-40" />
                گفتگویی یافت نشد
              </div>
            ) : (
              filtered.map((c) => {
                const isActive = selectedId === c.id;
                const isAnswered = answered[c.id];
                const status = CONVO_STATUS[c.status] || { label: c.status, color: "" };
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-right px-3 py-3 border-b transition-colors ${
                      isActive ? "bg-primary/5 border-r-2 border-r-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-[10px] bg-muted">
                            {c.endUserName?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{c.endUserName || "مهمان"}</div>
                          <div className="text-[11px] text-muted-foreground font-mono truncate">{c.endUserPhone || c.channel}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{timeAgo(c.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${status.color}`}>
                        {status.label}
                      </span>
                      {c.status === "handoff" && !isAnswered && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">
                          <AlertTriangle className="size-2.5" /> نیاز به پاسخ
                        </span>
                      )}
                      {isAnswered && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 text-emerald-700 px-1.5 py-0.5 text-[10px]">
                          <Check className="size-2.5" /> پاسخ داده شد
                        </span>
                      )}
                      {c.leadCaptured && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-pink-500/15 text-pink-600 px-1.5 py-0.5 text-[10px]">
                          <UserPlus className="size-2.5" />
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground mr-auto font-mono">
                        {toFa(c.messageCount)} پیام
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Active conversation (right) */}
        <main className={`flex-1 flex flex-col min-w-0 ${selectedId ? "flex" : "hidden md:flex"}`}>
          {!selected ? (
            <div className="flex-1 grid place-items-center p-6">
              <div className="flex flex-col items-center gap-3 text-center max-w-sm">
                <div className="grid place-items-center size-16 rounded-2xl bg-muted text-muted-foreground">
                  <MessageSquare className="size-8" />
                </div>
                <div>
                  <h2 className="font-bold mb-1">گفتگویی انتخاب نشده</h2>
                  <p className="text-sm text-muted-foreground">برای شروع پاسخ‌گویی، یک گفتگو از صف سمت راست انتخاب کنید.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="border-b bg-background px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden -mr-1"
                      onClick={() => setSelectedId(null)}
                    >
                      <ChevronRight className="size-5" />
                    </Button>
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/15 text-primary">
                        {selected.endUserName?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{selected.endUserName || "مهمان"}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <ChannelIcon channel={selected.channel} />
                        <span className="font-mono">{selected.endUserPhone || selected.channel}</span>
                        <span>•</span>
                        <span>{timeAgo(selected.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${CONVO_STATUS[selected.status]?.color}`}>
                      {CONVO_STATUS[selected.status]?.label}
                    </Badge>
                    {selected.leadCaptured && (
                      <Badge variant="secondary" className="text-[10px] gap-0.5">
                        <UserPlus className="size-2.5" /> لید
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Handoff banner */}
                {selected.status === "handoff" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2"
                  >
                    <Alert className="border-amber-500/40 bg-amber-500/10">
                      <AlertTriangle className="text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                        این گفتگو به شما ارجاع داده شده است — هوش مصنوعی توانایی پاسخگویی را نداشته و منتظر واکنش شماست.
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </div>

              {/* Messages */}
              <div ref={msgScrollRef} className="flex-1 overflow-y-auto scroll-area p-4 space-y-3 bg-muted/20">
                {loadingMsg ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 ? "justify-start" : "justify-end"}`}>
                        <Skeleton className={`h-12 ${i % 2 ? "w-48" : "w-64"} rounded-2xl`} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-10">
                    پیامی در این گفتگو وجود ندارد
                  </div>
                ) : (
                  messages.map((m) => <MessageBubble key={m.id} msg={m} />)
                )}
              </div>

              {/* Reply box */}
              <div className="border-t bg-background p-3">
                {answered[selected.id] ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="size-4" />
                      این گفتگو پاسخ داده شد
                    </div>
                    <Button size="sm" variant="ghost" onClick={markAnswered} className="text-xs h-7">
                      بازگردانی
                    </Button>
                  </div>
                ) : null}

                <div className="flex items-end gap-2 mt-2">
                  <Textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="پاسخ خود را بنویسید…"
                    className="min-h-12 max-h-32 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    onClick={sendReply}
                    disabled={!reply.trim() || sending}
                    className="size-10 shrink-0"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={markAnswered} className="gap-1.5 h-7 text-xs">
                      <Check className="size-3.5" />
                      {answered[selected.id] ? "برداشتن علامت" : "پاسخ‌داده‌شده"}
                    </Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Ctrl + Enter برای ارسال
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${color}`}>
      {icon}
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground hidden lg:inline">{label}</span>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  switch (channel) {
    case "voice":
      return <Phone className="size-3" />;
    case "website":
      return <Globe className="size-3" />;
    case "instagram":
      return <Instagram className="size-3" />;
    default:
      return <MessageSquare className="size-3" />;
  }
}

function MessageBubble({ msg }: { msg: ConvMessage }) {
  const isUser = msg.role === "user";
  const isAssistant = msg.role === "assistant";
  const isOperator = msg.role === "operator";
  const isSystem = msg.role === "system";

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="inline-block text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  const conf = msg.confidence !== undefined ? Math.round(msg.confidence * 100) : null;
  const sources = (msg.sources || []) as RagSource[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`flex gap-2 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <Avatar className="size-7 shrink-0 mt-0.5">
          <AvatarFallback className={`text-[10px] ${
            isUser ? "bg-sky-500/15 text-sky-600" :
            isAssistant ? "bg-primary/15 text-primary" :
            "bg-amber-500/15 text-amber-600"
          }`}>
            {isUser ? <User className="size-3.5" /> : isAssistant ? <Bot className="size-3.5" /> : <Headphones className="size-3.5" />}
          </AvatarFallback>
        </Avatar>
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          <div className={`rounded-2xl px-3.5 py-2 text-sm leading-6 ${
            isUser ? "bg-sky-500/15 text-foreground rounded-tl-sm" :
            isAssistant ? "bg-primary text-primary-foreground rounded-tr-sm" :
            "bg-amber-500/15 text-foreground border border-amber-500/30 rounded-tr-sm"
          }`}>
            {msg.content}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            {isAssistant && conf !== null && (
              <span className="inline-flex items-center gap-0.5">
                <Sparkles className="size-2.5" />
                اطمینان: {toFa(conf)}٪
              </span>
            )}
            {isOperator && (
              <span className="inline-flex items-center gap-0.5">
                <Headphones className="size-2.5" />
                اپراتور
              </span>
            )}
            {isUser && (
              <span className="inline-flex items-center gap-0.5">
                <User className="size-2.5" />
                کاربر
              </span>
            )}
            {msg.createdAt && (
              <span className="font-mono">{formatDate(msg.createdAt)}</span>
            )}
          </div>
          {sources.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {sources.slice(0, 3).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  <FileText className="size-2.5" />
                  {s.title?.slice(0, 20) || "منبع"}
                </span>
              ))}
            </div>
          )}
          {msg.handoff && (
            <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-amber-600">
              <AlertTriangle className="size-2.5" />
              ارجاع به اپراتور
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
