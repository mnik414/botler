"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  MessagesSquare, Search, Bot, User, Headphones, Send, Loader2, FileText,
  ShieldCheck, UserPlus,
} from "lucide-react";
import { api, type Conversation } from "@/lib/api-client";
import type { ChatMessage } from "@/lib/types";
import { toFa, timeAgo, CONVO_STATUS } from "@/lib/format";
import { toast } from "sonner";
import { SectionCard, LoadingBlock, ErrorBlock, EmptyState, useAsync } from "./shared";

interface ExtendedMessage extends ChatMessage {
  id: string;
  sources?: any[];
}

export function ConversationsTab({ tenantId }: { tenantId: string }) {
  const { data, loading, error, reload } = useAsync<Conversation[]>(() => api(`/api/conversations?tenantId=${tenantId}`), [tenantId]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const convos = (data || []).filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!(`${c.endUserName} ${c.endUserPhone}`.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  React.useEffect(() => {
    if (!selectedId && convos.length > 0) setSelectedId(convos[0].id);
  }, [data, selectedId, convos]);

  if (loading) return <LoadingBlock lines={4} />;
  if (error || !data) return <ErrorBlock message={error || undefined} onRetry={reload} />;

  const selected = convos.find((c) => c.id === selectedId) || null;

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-160px)] min-h-[500px]">
      {/* List */}
      <SectionCard
        title="گفتگوها"
        bodyClassName="p-0 flex flex-col h-full"
        className="flex flex-col overflow-hidden"
      >
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="size-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام یا تلفن…"
              className="pr-8 h-9 text-sm"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="ai">پاسخ هوش مصنوعی</SelectItem>
              <SelectItem value="handoff">انتقال به اپراتور</SelectItem>
              <SelectItem value="closed">بسته شده</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto scroll-area">
          {convos.length === 0 ? (
            <EmptyState icon={MessagesSquare} title="گفتگویی یافت نشد" description="فیلتر یا جستجوی خود را تغییر دهید." />
          ) : (
            convos.map((c) => {
              const st = CONVO_STATUS[c.status] || CONVO_STATUS.ai;
              const active = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-start gap-3 w-full p-3 border-b text-right transition ${
                    active ? "bg-primary/5 border-r-2 border-r-primary" : "hover:bg-accent"
                  }`}
                >
                  <Avatar className="size-9 mt-0.5">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {(c.endUserName || "م").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{c.endUserName || "مهمان"}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(c.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${st.color}`}>{st.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{c.channel}</span>
                      <span className="text-[10px] text-muted-foreground">· {toFa(c.messageCount)} پیام</span>
                      {c.leadCaptured && <UserPlus className="size-3 text-emerald-600" />}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </SectionCard>

      {/* Detail */}
      <div className="min-h-0">
        {selected ? (
          <ConversationDetail key={selected.id} conversation={selected} onReply={reload} />
        ) : (
          <Card className="h-full grid place-items-center">
            <CardContent>
              <EmptyState icon={MessagesSquare} title="یک گفتگو انتخاب کنید" description="برای مشاهده پیام‌ها، یک گفتگو از فهرست انتخاب کنید." />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ConversationDetail({ conversation, onReply }: { conversation: Conversation; onReply: () => void }) {
  const { data: messages, loading, error, reload } = useAsync<ExtendedMessage[]>(
    () => api(`/api/conversations/${conversation.id}/messages?tenantId=${conversation.tenantId}`),
    [conversation.id, conversation.tenantId]
  );
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const st = CONVO_STATUS[conversation.status] || CONVO_STATUS.ai;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ conversationId: conversation.id, content: text, tenantId: conversation.tenantId }),
      });
      setReply("");
      toast.success("پاسخ شما ارسال شد.");
      reload();
      onReply();
    } catch (e: any) {
      toast.error(e.message || "خطا در ارسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary/15 text-primary text-sm font-bold">
              {(conversation.endUserName || "م").charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{conversation.endUserName || "مهمان"}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>{conversation.channel}</span>
              <span>·</span>
              <span>{conversation.endUserPhone || "بدون شماره"}</span>
              <span>·</span>
              <span>{toFa(conversation.messageCount)} پیام</span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.label}</Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-area p-4 space-y-3 bg-muted/20">
        {loading ? (
          <div className="space-y-3"><LoadingBlock lines={4} /></div>
        ) : error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : (messages || []).length === 0 ? (
          <EmptyState icon={MessagesSquare} title="پیامی وجود ندارد" />
        ) : (
          (messages || []).map((m) => <MessageBubble key={m.id} m={m} />)
        )}
      </div>

      {/* Reply box (if handoff) */}
      {conversation.status === "handoff" && (
        <div className="border-t p-3 bg-card">
          <div className="text-[11px] text-amber-600 mb-2 flex items-center gap-1">
            <Headphones className="size-3.5" /> این گفتگو به اپراتور ارجاع داده شده — پاسخ شما مستقیم به مشتری ارسال می‌شود.
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder="پاسخ اپراتور…"
              className="resize-none text-sm"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
            />
            <Button onClick={sendReply} disabled={sending || !reply.trim()} className="gap-1.5 shrink-0">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              ارسال
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function MessageBubble({ m }: { m: ExtendedMessage }) {
  const isUser = m.role === "user";
  const isOperator = m.role === "operator";
  const isAssistant = m.role === "assistant";

  const Icon = isUser ? User : isOperator ? Headphones : Bot;
  const bgClass = isUser
    ? "bg-background border"
    : isOperator
      ? "bg-amber-500/10 border border-amber-500/30"
      : "bg-primary text-primary-foreground";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar className="size-7 shrink-0 mt-0.5">
        <AvatarFallback className={`text-[10px] ${isUser ? "bg-muted text-muted-foreground" : isOperator ? "bg-amber-500/20 text-amber-600" : "bg-primary/15 text-primary"}`}>
          <Icon className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`px-3.5 py-2 rounded-2xl text-sm leading-6 ${bgClass} ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}>
          <p className="whitespace-pre-wrap break-words">{m.content}</p>
        </div>
        {isAssistant && (m.confidence !== undefined || (m.sources && m.sources.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1 mt-1 px-1">
            {m.confidence !== undefined && m.confidence > 0 && (
              <Badge variant="outline" className={`text-[10px] gap-0.5 ${m.confidence > 0.6 ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}`}>
                <ShieldCheck className="size-2.5" /> {toFa(Math.round(m.confidence * 100))}٪
              </Badge>
            )}
            {(m.sources || []).slice(0, 2).map((s, j) => (
              <Badge key={j} variant="outline" className="text-[10px] gap-0.5 border-primary/30 text-primary">
                <FileText className="size-2.5" /> {(s.title || "منبع").slice(0, 18)}
              </Badge>
            ))}
          </div>
        )}
        {m.createdAt && (
          <div className="text-[10px] text-muted-foreground mt-0.5 px-1">{timeAgo(m.createdAt)}</div>
        )}
      </div>
    </div>
  );
}
