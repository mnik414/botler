// Channel Adapters — abstraction for sending/receiving messages across social platforms.
// Each platform implements: sendMessage, verifyWebhook, parseIncomingMessage.
// Adding a new platform = implement ChannelAdapter + register in CHANNEL_REGISTRY.

import { createHmac } from "crypto";
import { safeEqual } from "@/lib/safe-equal";

export type PlatformCode = "instagram" | "whatsapp" | "telegram" | "bale" | "tiktok" | "airbnb" | "widget" | "voice";

export interface IncomingMessage {
  senderId: string;
  senderName: string;
  text: string;
  eventKey: string; // unique per platform event, used for idempotency
}

export interface WebhookContext {
  secret: string; // per-connection generated secret
  credentials: any; // decrypted/parsed credentials JSON
}

export interface ChannelAdapter {
  code: PlatformCode;
  name: string;
  icon: string; // lucide icon name
  color: string; // brand color
  description: string;
  setupSteps: string[];
  credentialsFields: { key: string; label: string; type: "text" | "password"; placeholder: string; required: boolean }[];
  // Send a message to a user on this platform
  sendMessage(credentials: any, recipientId: string, text: string): Promise<{ ok: boolean; error?: string }>;
  // Verify incoming webhook signature using the raw request body
  verifyWebhook(headers: Record<string, string>, rawBody: string, ctx: WebhookContext): boolean;
  // Parse incoming webhook into standard messages. Meta batches multiple
  // messages per POST, so this always returns an array.
  parseIncomingMessages(body: any): IncomingMessage[];
}

// Meta (Instagram/WhatsApp) signs payloads with the app secret:
// X-Hub-Signature-256: sha256=<hex hmac of raw body>
function verifyMetaSignature(headers: Record<string, string>, rawBody: string, appSecret: string | undefined): boolean {
  if (!appSecret) return false;
  const header = headers["x-hub-signature-256"];
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return safeEqual(header.slice("sha256=".length), expected);
}

// ────────────────────────────────────────────────────────────
// Instagram (via Meta Graph API / Instagram Messaging)
// ────────────────────────────────────────────────────────────
const InstagramAdapter: ChannelAdapter = {
  code: "instagram",
  name: "اینستاگرام",
  icon: "Instagram",
  color: "#E1306C",
  description: "پاسخ خودکار به دایرکت اینستاگرام با هوش مصنوعی. نیاز به بیزینس اکانت و اتصال به Meta API.",
  setupSteps: [
    "به Meta for Developers بروید و یک اپ بسازید",
    "Instagram Graph API و Instagram Messaging API را فعال کنید",
    "Access Token و Page ID اکانت بیزینس خود را دریافت کنید",
    "Webhook URL زیر را در تنظیمات اپ ثبت کنید",
    "اشتراک webhook برای messages و messaging_postbacks را فعال کنید",
  ],
  credentialsFields: [
    { key: "accessToken", label: "Access Token", type: "password", placeholder: "IGQVJ...", required: true },
    { key: "pageId", label: "Page ID", type: "text", placeholder: "123456789", required: true },
    { key: "appSecret", label: "App Secret", type: "password", placeholder: "Meta App Secret", required: true },
    { key: "verifyToken", label: "Verify Token", type: "text", placeholder: "your-verify-token", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${creds.pageId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.accessToken}` },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers, rawBody, ctx) {
    return verifyMetaSignature(headers, rawBody, ctx.credentials?.appSecret);
  },
  parseIncomingMessages(body: any) {
    const messages: IncomingMessage[] = [];
    for (const entry of body?.entry || []) {
      for (const messaging of entry?.messaging || []) {
        if (!messaging?.message?.text) continue;
        messages.push({
          senderId: messaging.sender?.id || "",
          senderName: messaging.sender?.username || "کاربر اینستاگرام",
          text: messaging.message.text,
          eventKey: String(messaging.message?.mid || messaging.timestamp || ""),
        });
      }
    }
    return messages;
  },
};

// ────────────────────────────────────────────────────────────
// WhatsApp (via WhatsApp Cloud API)
// ────────────────────────────────────────────────────────────
const WhatsAppAdapter: ChannelAdapter = {
  code: "whatsapp",
  name: "واتساپ",
  icon: "MessageCircle",
  color: "#25D366",
  description: "پاسخ خودکار به پیام‌های واتساپ با هوش مصنوعی. نیاز به WhatsApp Business API و شماره تأیید شده.",
  setupSteps: [
    "به Meta Business Manager بروید و WhatsApp Business API را فعال کنید",
    "شماره تلفن کسب‌وکار خود را ثبت و تأیید کنید",
    "Access Token و Phone Number ID را دریافت کنید",
    "Webhook URL زیر را در تنظیمات ثبت کنید",
    "اشتراک webhook برای messages را فعال کنید",
  ],
  credentialsFields: [
    { key: "accessToken", label: "Access Token", type: "password", placeholder: "EAAG...", required: true },
    { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "123456789", required: true },
    { key: "appSecret", label: "App Secret", type: "password", placeholder: "Meta App Secret", required: true },
    { key: "verifyToken", label: "Verify Token", type: "text", placeholder: "your-verify-token", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${creds.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.accessToken}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to: recipientId, type: "text", text: { body: text } }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers, rawBody, ctx) {
    return verifyMetaSignature(headers, rawBody, ctx.credentials?.appSecret);
  },
  parseIncomingMessages(body: any) {
    const messages: IncomingMessage[] = [];
    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const contacts = change?.value?.contacts || [];
        for (const msg of change?.value?.messages || []) {
          if (!msg?.text?.body) continue;
          const contact = contacts.find((c: any) => c.wa_id === msg.from) || contacts[0];
          messages.push({
            senderId: msg.from || "",
            senderName: contact?.profile?.name || msg.from || "کاربر واتساپ",
            text: msg.text.body,
            eventKey: String(msg.id || ""),
          });
        }
      }
    }
    return messages;
  },
};

// ────────────────────────────────────────────────────────────
// Bale (Iranian Messenger — Bale Bot API, similar to Telegram)
// ────────────────────────────────────────────────────────────
const BaleAdapter: ChannelAdapter = {
  code: "bale",
  name: "بله مسنجر",
  icon: "MessageSquare",
  color: "#2CA7E0",
  description: "پاسخ خودکار به پیام‌های بله مسنجر با هوش مصنوعی. نیاز به ربات بله (BotFather@).",
  setupSteps: [
    "در بله مسنجر به @BotFather پیام دهید و /newbot را بزنید",
    "نام و یوزرنیم ربات را وارد کنید",
    "Bot Token دریافتی را در فیلد زیر وارد کنید",
    "Webhook به‌طور خودکار با ذخیره تنظیم می‌شود",
  ],
  credentialsFields: [
    { key: "botToken", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF...", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      // Bale Bot API is very similar to Telegram Bot API
      const res = await fetch(`https://tapi.bale.ai/bot${creds.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: recipientId, text }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      // Telegram-style APIs return HTTP 200 with { ok:false, description } on
      // logical failures (e.g. "bot was blocked by the user").
      if (!res.ok || !data?.ok) {
        return { ok: false, error: String(data?.description || `HTTP ${res.status}`).slice(0, 200) };
      }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers, _rawBody, ctx) {
    if (!ctx.secret) return false;
    const provided = headers["x-telegram-bot-api-secret-token"] || headers["x-bale-bot-api-secret-token"] || "";
    return provided.length > 0 && safeEqual(provided, ctx.secret);
  },
  parseIncomingMessages(body: any) {
    const msg = body?.message;
    if (!msg?.text) return [];
    return [{
      senderId: String(msg.chat?.id || msg.from?.id || ""),
      senderName: msg.from?.first_name || msg.from?.username || "کاربر بله",
      text: msg.text,
      eventKey: String(body?.update_id ?? msg.message_id ?? ""),
    }];
  },
  // Bale-specific: set webhook on save (similar to Telegram)
  async setWebhook(botToken: string, webhookUrl: string, secret: string) {
    try {
      const res = await fetch(`https://tapi.bale.ai/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch { return false; }
  },
} as any;

// ────────────────────────────────────────────────────────────
// Telegram (via Telegram Bot API)
// ────────────────────────────────────────────────────────────
const TelegramAdapter: ChannelAdapter = {
  code: "telegram",
  name: "تلگرام",
  icon: "Send",
  color: "#0088CC",
  description: "پاسخ خودکار به پیام‌های تلگرام با هوش مصنوعی. نیاز به ربات تلگرام (BotFather).",
  setupSteps: [
    "در تلگرام به @BotFather پیام دهید و /newbot را بزنید",
    "نام و یوزرنیم ربات را وارد کنید",
    "Bot Token دریافتی را در فیلد زیر وارد کنید",
    "Webhook به‌طور خودکار با ذخیره تنظیم می‌شود",
  ],
  credentialsFields: [
    { key: "botToken", label: "Bot Token", type: "password", placeholder: "123456:ABC-DEF...", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: recipientId, text }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json().catch(() => null);
      // Telegram returns HTTP 200 with { ok:false, description } on failures.
      if (!res.ok || !data?.ok) {
        return { ok: false, error: String(data?.description || `HTTP ${res.status}`).slice(0, 200) };
      }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers, _rawBody, ctx) {
    if (!ctx.secret) return false;
    const provided = headers["x-telegram-bot-api-secret-token"] || "";
    return provided.length > 0 && safeEqual(provided, ctx.secret);
  },
  parseIncomingMessages(body: any) {
    const msg = body?.message;
    if (!msg?.text) return [];
    return [{
      senderId: String(msg.chat?.id || ""),
      senderName: msg.from?.first_name || msg.from?.username || "کاربر تلگرام",
      text: msg.text,
      eventKey: String(body?.update_id ?? msg.message_id ?? ""),
    }];
  },
  // Telegram-specific: set webhook on save
  async setWebhook(botToken: string, webhookUrl: string, secret: string) {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(secret)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    return res.ok;
  },
} as any;

// ────────────────────────────────────────────────────────────
// TikTok (TikTok Business Messaging API)
// ────────────────────────────────────────────────────────────
const TikTokAdapter: ChannelAdapter = {
  code: "tiktok",
  name: "تیک‌تاک",
  icon: "Video",
  color: "#000000",
  description: "پاسخ خودکار به پیام‌های تیک‌تاک با هوش مصنوعی. نیاز به TikTok Business Account و اتصال به TikTok Messaging API.",
  setupSteps: [
    "به TikTok for Developers بروید و یک اپ بسازید",
    "TikTok Business Messaging API را فعال کنید",
    "Access Token و App ID دریافت کنید",
    "Webhook URL زیر را در تنظیمات اپ ثبت کنید",
    "اشتراک webhook برای message.receive را فعال کنید",
  ],
  credentialsFields: [
    { key: "accessToken", label: "Access Token", type: "password", placeholder: "tt.xxx...", required: true },
    { key: "appId", label: "App ID", type: "text", placeholder: "123456789", required: true },
    { key: "appSecret", label: "App Secret", type: "password", placeholder: "TikTok App Secret", required: true },
    { key: "verifyToken", label: "Verify Token", type: "text", placeholder: "your-verify-token", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://open.tiktokapis.com/v2/business/message/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Access-Token": creds.accessToken },
        body: JSON.stringify({ app_id: creds.appId, to: recipientId, message: { text } }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers, rawBody, ctx) {
    const appSecret = ctx.credentials?.appSecret;
    const signature = headers["tiktok-signature"];
    if (!appSecret || !signature) return false;
    // Structured form: "t=<unix-ts>,s=<hex hmac of `${t}.${body}`>".
    const structured = signature.match(/t=(\d+)\s*[,;]\s*s=([0-9a-f]+)/i);
    if (structured) {
      const timestamp = Number(structured[1]);
      // Reject stale signatures (5 minute replay window).
      if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
      const expected = createHmac("sha256", appSecret).update(`${structured[1]}.${rawBody}`, "utf8").digest("hex");
      return safeEqual(structured[2].toLowerCase(), expected);
    }
    // Legacy fallback: raw hex HMAC over the body.
    const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
    return safeEqual(signature.toLowerCase(), expected);
  },
  parseIncomingMessages(body: any) {
    const event = body?.event;
    const data = body?.data;
    if (event !== "message.receive" || !data?.content?.text) return [];
    return [{
      senderId: data?.from?.open_id || "",
      senderName: data?.from?.name || "کاربر تیک‌تاک",
      text: data.content.text,
      eventKey: String(data?.message_id || data?.content?.message_id || ""),
    }];
  },
};

// ────────────────────────────────────────────────────────────
// Airbnb (Airbnb Host Messaging API)
// ────────────────────────────────────────────────────────────
const AirbnbAdapter: ChannelAdapter = {
  code: "airbnb",
  name: "Airbnb",
  icon: "Home",
  color: "#FF5A5F",
  description: "پاسخ خودکار به پیام‌های مهمانان Airbnb با هوش مصنوعی. مناسب هتل‌ها و آژانس‌های گردشگری. نیاز به Airbnb API Token.",
  setupSteps: [
    "به Airbnb Developer Portal بروید و درخواست API access بدهید",
    "Access Token و Listing ID دریافت کنید",
    "Webhook URL زیر را در تنظیمات ثبت کنید",
    "اشتراک webhook برای message_received را فعال کنید",
  ],
  credentialsFields: [
    { key: "accessToken", label: "Access Token", type: "password", placeholder: "airbnb.xxx...", required: true },
    { key: "listingId", label: "Listing ID", type: "text", placeholder: "12345678", required: true },
    { key: "verifyToken", label: "Verify Token", type: "text", placeholder: "your-verify-token", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://api.airbnb.com/v2/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Airbnb-API-Key": creds.accessToken },
        body: JSON.stringify({ listing_id: creds.listingId, recipient_id: recipientId, message: text }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  // Airbnb does not document webhook signatures; reject until a verifier is implemented.
  verifyWebhook() { return false; },
  parseIncomingMessages(body: any) {
    const msg = body?.message;
    if (!msg?.text) return [];
    return [{
      senderId: String(msg?.sender?.id || ""),
      senderName: msg?.sender?.first_name || "مهمان Airbnb",
      text: msg.text,
      eventKey: String(msg?.id || ""),
    }];
  },
};

// ────────────────────────────────────────────────────────────
// Widget (already integrated — website chat widget)
// ────────────────────────────────────────────────────────────
const WidgetAdapter: ChannelAdapter = {
  code: "widget",
  name: "ویجت وب‌سایت",
  icon: "Globe",
  color: "#10b981",
  description: "منشی هوشمند روی وب‌سایت شما. نیاز به قرار دادن کد امبد در سایت.",
  setupSteps: [
    "کد امبد زیر را در HTML سایت خود قرار دهید",
    "منشی به‌طور خودکار در گوشه سایت نمایش داده می‌شود",
  ],
  credentialsFields: [],
  async sendMessage() { return { ok: true }; },
  verifyWebhook() { return false; },
  parseIncomingMessages() { return []; },
};

// ────────────────────────────────────────────────────────────
// Voice (AI Voice Agent — phone)
// ────────────────────────────────────────────────────────────
const VoiceAdapter: ChannelAdapter = {
  code: "voice",
  name: "تماس صوتی",
  icon: "Phone",
  color: "#8B5CF6",
  description: "پاسخگویی تلفنی با هوش مصنوعی. نیاز به شماره مجازی و اتصال به سرویس صوتی.",
  setupSteps: [
    "یک شماره مجازی تهیه کنید (مثل Twilio یا سرویس ایرانی)",
    "Account SID و Auth Token را وارد کنید",
    "شماره را به webhook زیر فوروارد کنید",
  ],
  credentialsFields: [
    { key: "accountSid", label: "Account SID", type: "text", placeholder: "AC...", required: true },
    { key: "authToken", label: "Auth Token", type: "password", placeholder: "••••", required: true },
    { key: "fromNumber", label: "شماره تلفن", type: "text", placeholder: "+98...", required: true },
  ],
  async sendMessage() { return { ok: true }; },
  verifyWebhook() { return false; },
  parseIncomingMessages() { return []; },
};

// ────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────
const CHANNEL_REGISTRY: Record<string, ChannelAdapter> = {
  instagram: InstagramAdapter,
  whatsapp: WhatsAppAdapter,
  bale: BaleAdapter,
  telegram: TelegramAdapter,
  tiktok: TikTokAdapter,
  airbnb: AirbnbAdapter,
  widget: WidgetAdapter,
  voice: VoiceAdapter,
};

export function getChannelAdapter(code: string): ChannelAdapter | null {
  return CHANNEL_REGISTRY[code] || null;
}

export function listChannels(): ChannelAdapter[] {
  return Object.values(CHANNEL_REGISTRY);
}
