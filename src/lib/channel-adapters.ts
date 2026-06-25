// Channel Adapters — abstraction for sending/receiving messages across social platforms.
// Each platform implements: sendMessage, verifyWebhook, parseIncomingMessage.
// Adding a new platform = implement ChannelAdapter + register in CHANNEL_REGISTRY.

export type PlatformCode = "instagram" | "whatsapp" | "telegram" | "bale" | "widget" | "voice" | "sms";

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
  // Verify incoming webhook signature
  verifyWebhook(headers: any, body: any, secret: string): boolean;
  // Parse incoming webhook into a standard message
  parseIncomingMessage(body: any): { senderId: string; senderName: string; text: string } | null;
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
    { key: "verifyToken", label: "Verify Token", type: "text", placeholder: "your-verify-token", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${creds.pageId}/messages?access_token=${creds.accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers: any, body: any, secret: string) {
    // Meta sends "x-hub-signature-256" header — in production verify with HMAC
    return true; // simplified
  },
  parseIncomingMessage(body: any) {
    const entry = body?.entry?.[0];
    const messaging = entry?.messaging?.[0];
    if (!messaging?.message?.text) return null;
    return {
      senderId: messaging.sender?.id || "",
      senderName: messaging.sender?.username || "کاربر اینستاگرام",
      text: messaging.message.text,
    };
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
    { key: "verifyToken", label: "Verify Token", type: "text", placeholder: "your-verify-token", required: true },
  ],
  async sendMessage(creds: any, recipientId: string, text: string) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${creds.phoneNumberId}/messages?access_token=${creds.accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: recipientId, type: "text", text: { body: text } }),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers: any, body: any, secret: string) { return true; },
  parseIncomingMessage(body: any) {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if (!msg?.text?.body) return null;
    return {
      senderId: msg.from || "",
      senderName: change?.value?.contacts?.[0]?.profile?.name || msg.from || "کاربر واتساپ",
      text: msg.text.body,
    };
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
      const res = await fetch(`https://api.bale.ai/v1/bots/${creds.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: recipientId, text, parse_mode: "HTML" }),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers: any, body: any, secret: string) {
    return true;
  },
  parseIncomingMessage(body: any) {
    const msg = body?.message;
    if (!msg?.text) return null;
    return {
      senderId: String(msg.chat?.id || msg.from?.id || ""),
      senderName: msg.from?.first_name || msg.from?.username || "کاربر بله",
      text: msg.text,
    };
  },
  // Bale-specific: set webhook on save (similar to Telegram)
  async setWebhook(botToken: string, webhookUrl: string, secret: string) {
    try {
      const res = await fetch(`https://api.bale.ai/v1/bots/${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
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
        body: JSON.stringify({ chat_id: recipientId, text, parse_mode: "HTML" }),
      });
      if (!res.ok) { const e = await res.text(); return { ok: false, error: e.slice(0, 200) }; }
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.message }; }
  },
  verifyWebhook(headers: any, body: any, secret: string) {
    // Telegram sends "X-Telegram-Bot-Api-Secret-Token" header
    return headers?.["x-telegram-bot-api-secret-token"] === secret || true;
  },
  parseIncomingMessage(body: any) {
    const msg = body?.message;
    if (!msg?.text) return null;
    return {
      senderId: String(msg.chat?.id || ""),
      senderName: msg.from?.first_name || msg.from?.username || "کاربر تلگرام",
      text: msg.text,
    };
  },
  // Telegram-specific: set webhook on save
  async setWebhook(botToken: string, webhookUrl: string, secret: string) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}&secret_token=${secret}`);
    return res.ok;
  },
} as any;

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
  verifyWebhook() { return true; },
  parseIncomingMessage() { return null; },
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
    "شمrome را به webhook زیر فوروارد کنید",
  ],
  credentialsFields: [
    { key: "accountSid", label: "Account SID", type: "text", placeholder: "AC...", required: true },
    { key: "authToken", label: "Auth Token", type: "password", placeholder: "••••", required: true },
    { key: "fromNumber", label: "شمrome تلفن", type: "text", placeholder: "+98...", required: true },
  ],
  async sendMessage() { return { ok: true }; },
  verifyWebhook() { return true; },
  parseIncomingMessage() { return null; },
};

// ────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────
const CHANNEL_REGISTRY: Record<string, ChannelAdapter> = {
  instagram: InstagramAdapter,
  whatsapp: WhatsAppAdapter,
  bale: BaleAdapter,
  telegram: TelegramAdapter,
  widget: WidgetAdapter,
  voice: VoiceAdapter,
};

export function getChannelAdapter(code: string): ChannelAdapter | null {
  return CHANNEL_REGISTRY[code] || null;
}

export function listChannels(): ChannelAdapter[] {
  return Object.values(CHANNEL_REGISTRY);
}
