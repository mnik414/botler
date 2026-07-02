"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare, X, Send, Sparkles, Phone, Mail, FileText, Globe,
  Mic, Paperclip, ShieldCheck, AlertCircle, UserPlus, TrendingUp,
  ChevronLeft, Bot, Wifi, CalendarCheck,
} from "lucide-react";
import { api, type ChatResponse } from "@/lib/api-client";
import type { ChatMessage } from "@/lib/types";
import { toFa, timeAgo } from "@/lib/format";
import { toast } from "sonner";

interface FloatingWidgetProps {
  tenantId: string;
  initialOpen?: boolean;
  variant?: "floating" | "panel";
  accentColor?: string;
  businessName?: string;
}

export function FloatingWidget({ tenantId, initialOpen = false, variant = "floating", accentColor }: FloatingWidgetProps) {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [lastMeta, setLastMeta] = useState<ChatResponse | null>(null);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load tenant info + greeting
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await api<any>(`/api/tenants/${tenantId}`);
        if (!mounted) return;
        setTenant(t);
        const agent = await api<any>(`/api/agent/${tenantId}`);
        if (!mounted) return;
        setMessages([
          {
            role: "assistant",
            content: agent.greetingMessage || `سلام! من منشی هوشمند ${t.name} هستم. چطور می‌توانم کمکتان کنم؟`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [tenantId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: ChatMessage = { role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const res = await api<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ tenantId, conversationId, message: text, history: messages }),
      });
      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.reply, confidence: res.confidence, sources: res.sources, createdAt: new Date().toISOString() },
      ]);
      setLastMeta(res);
      if (res.leadCreated) toast.success("اطلاعات شما ثبت شد، به‌زودی تماس می‌گیریم.");
      if (res.bookingCreated) toast.success(`${res.bookingCreated.label} شما ثبت شد ✓`);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "متأسفم، خطایی رخ داد. لطفاً دوباره تلاش کنید.", createdAt: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationId, tenantId, messages]);

  // File upload — sends the file content as a user message + uploads to knowledge base
  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.size > 5 * 1024 * 1024) { toast.error("حداکثر حجم فایل ۵ مگابایت"); return; }
    // For text-like files, read & send content; for others, acknowledge the attachment
    const name = f.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".json")) {
      const text = await f.text();
      setInput(prev => prev + (prev ? "\n" : "") + text.slice(0, 2000));
      toast.success(`محتوای ${f.name} به پیام افزوده شد`);
    } else {
      setMessages(m => [...m, { role: "user", content: `📎 فایل پیوست شد: ${f.name}`, createdAt: new Date().toISOString() }]);
      toast.success(`فایل ${f.name} پیوست شد`);
    }
  };

  // Voice input via Web Speech API (Persian)
  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند"); return; }
    const rec = new SR();
    rec.lang = "fa-IR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev: any) => {
      let txt = "";
      for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      setInput(txt);
    };
    rec.onend = () => { setListening(false); };
    rec.onerror = () => { setListening(false); toast.error("خطا در تشخیص صدا"); };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    toast.info("در حال ضبط… صحبت کنید");
  };

  const accent = accentColor || tenant?.accentColor || "#10b981";

  const panel = (
    <div className="flex flex-col h-full bg-card rounded-2xl overflow-hidden shadow-2xl border" style={{ ["--w-accent" as any]: accent }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-10 border-2 border-white/30">
              <AvatarFallback className="bg-white/20 text-white"><Sparkles className="size-5" /></AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -left-0.5 size-3.5 rounded-full bg-emerald-400 border-2 border-white pulse-dot" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">{tenant?.agent?.name || `منشی ${tenant?.name || ""}`}</div>
            <div className="text-[11px] text-white/85 flex items-center gap-1"><Wifi className="size-3" /> آنلاین · پاسخ خودکار</div>
          </div>
        </div>
        {variant === "floating" && (
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition">
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-area px-3 py-4 space-y-3 bg-muted/30" style={{ minHeight: 280 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[82%] ${m.role === "user" ? "" : ""}`}>
              <div
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-6 ${
                  m.role === "user"
                    ? "bg-background border rounded-tr-sm"
                    : "text-white rounded-tl-sm"
                }`}
                style={m.role === "user" ? {} : { background: accent }}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>

              {m.role === "assistant" && (m.confidence !== undefined || (m.sources && m.sources.length > 0)) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 px-1">
                  {m.confidence !== undefined && (
                    <Badge variant="outline" className={`text-[10px] gap-1 ${m.confidence > 0.6 ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/30 text-amber-600"}`}>
                      <ShieldCheck className="size-2.5" /> اعتماد {toFa(Math.round(m.confidence * 100))}٪
                    </Badge>
                  )}
                  {m.sources && m.sources.slice(0, 2).map((s, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                      <FileText className="size-2.5" /> {s.title.slice(0, 22)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-end">
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-white flex items-center gap-1" style={{ background: accent }}>
              <span className="size-2 rounded-full bg-white typing-dot" style={{ animationDelay: "0ms" }} />
              <span className="size-2 rounded-full bg-white typing-dot" style={{ animationDelay: "150ms" }} />
              <span className="size-2 rounded-full bg-white typing-dot" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {lastMeta?.handoff && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-full px-3 py-1.5">
              <AlertCircle className="size-3.5" /> این گفتگو به اپراتور ارجاع داده شد
            </div>
          </div>
        )}
        {lastMeta?.bookingCreated && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 rounded-full px-3 py-1.5">
              <CalendarCheck className="size-3.5" /> {lastMeta.bookingCreated.label} شما ثبت شد ✓
            </div>
          </div>
        )}
        {lastMeta?.growth?.isBusinessOwner && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary border border-primary/30 rounded-full px-3 py-1.5">
              <TrendingUp className="size-3.5" /> این فناوری برای کسب‌وکار شما هم کاربرد دارد ✨
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && tenant && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {["ساعات کاری؟", "قیمت‌ها چطوره؟", "رزرو میز", "شماره تماس"].map((q) => (
            <button key={q} onClick={() => { setInput(q); }} className="text-xs bg-background border rounded-full px-3 py-1.5 hover:bg-accent transition">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-2.5 bg-card">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden" accept=".txt,.csv,.json,.pdf,.docx,.xlsx,.png,.jpg,.jpeg" onChange={onFilePick} />
          <button className="p-2 rounded-lg hover:bg-accent text-muted-foreground" title="پیوست فایل" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="size-4" />
          </button>
          <button className={`p-2 rounded-lg hover:bg-accent ${listening ? "text-red-500 bg-red-500/10" : "text-muted-foreground"}`} title="ورودی صوتی" onClick={toggleVoice}>
            <Mic className={`size-4 ${listening ? "animate-pulse" : ""}`} />
          </button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="پیام خود را بنویسید…"
            rows={1}
            className="resize-none min-h-[40px] max-h-24 text-sm"
          />
          <Button size="icon" onClick={send} disabled={loading || !input.trim()} style={{ background: accent }} className="shrink-0">
            <Send className="size-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Bot className="size-3" /> قدرت‌گرفته از هوش مصنوعی
          </span>
          {lastMeta?.leadCreated && (
            <span className="text-[10px] text-emerald-600 flex items-center gap-1"><UserPlus className="size-3" /> لید ثبت شد</span>
          )}
        </div>
      </div>
    </div>
  );

  if (variant === "panel") {
    return <div className="h-full">{panel}</div>;
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-5 left-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[min(560px,80vh)] shadow-2xl">
          {panel}
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full text-white pl-4 pr-3 py-3 shadow-2xl hover:scale-105 transition"
          style={{ background: accent }}
        >
          <MessageSquare className="size-5" />
          <span className="text-sm font-medium">گفتگوی تصادفی!</span>
        </button>
      )}
    </>
  );
}
