// Pluggable LLM provider layer.
// Supports: zai (default z-ai-web-dev-sdk), openai (OpenAI-compatible),
// anthropic (Claude), gemini (Google), custom (OpenAI-compatible with custom base URL).
//
// Each provider implements: callChat(provider, messages, opts) → { content, tokens }

export type ProviderType = "zai" | "openai" | "anthropic" | "gemini" | "openrouter" | "custom";

export interface AiProviderConfig {
  id: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResult {
  content: string;
  tokens: number;
}

const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  zai: "",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  openrouter: "https://openrouter.ai/api/v1",
  custom: "",
};

export function defaultBaseUrl(type: ProviderType): string {
  return DEFAULT_BASE_URLS[type] || "";
}

const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|\[::1\])/i;

// SSRF guard for user-supplied provider base URLs.
export function validateBaseUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "آدرس Base URL نامعتبر است" };
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_AI_BASE_URL === "1";
  if (!allowPrivate) {
    if (parsed.protocol !== "https:") return { ok: false, error: "Base URL باید با https شروع شود" };
    if (PRIVATE_HOST_RE.test(parsed.hostname)) return { ok: false, error: "آدرس‌های داخلی/خصوصی مجاز نیستند" };
  } else if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "پروتکل Base URL نامعتبر است" };
  }
  return { ok: true, url: raw.replace(/\/$/, "") };
}

const LLM_TIMEOUT_MS = 45_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = LLM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Main entry: dispatch to the right provider
export async function callLLM(
  provider: AiProviderConfig | null,
  messages: LLMMessage[],
  opts: { temperature?: number } = {}
): Promise<LLMResult> {
  // No custom provider → fall back to platform default (z-ai-web-dev-sdk)
  if (!provider) {
    console.log(`[callLLM] No provider - falling back to default Z.ai`);
    return callZai(messages, opts);
  }

  console.log(`[callLLM] Dispatching to ${provider.type}`, {
    model: provider.model,
    baseUrl: provider.baseUrl || defaultBaseUrl(provider.type),
  });

  switch (provider.type) {
    case "openai":
    case "openrouter":
    case "custom":
      return callOpenAICompatible(provider, messages, opts);
    case "anthropic":
      return callAnthropic(provider, messages, opts);
    case "gemini":
      return callGemini(provider, messages, opts);
    case "zai":
    default:
      return callZai(messages, opts);
  }
}

// ────────────────────────────────────────────────────────────
// Z.ai (default) — z-ai-web-dev-sdk
// ────────────────────────────────────────────────────────────
async function callZai(messages: LLMMessage[], opts: { temperature?: number }): Promise<LLMResult> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();
  // The SDK expects the system prompt as an "assistant" first message
  const mapped = messages.map((m) => ({
    role: m.role === "system" ? ("assistant" as const) : (m.role as "user" | "assistant"),
    content: m.content,
  }));
  const completion = await withTimeout(
    zai.chat.completions.create({
      messages: mapped as any,
      thinking: { type: "disabled" },
      temperature: opts.temperature ?? 0.4,
    } as any),
    LLM_TIMEOUT_MS,
    "Z.ai completion"
  );
  const content = completion.choices[0]?.message?.content?.trim() || "";
  return { content, tokens: Math.ceil(content.length / 4) };
}

// ────────────────────────────────────────────────────────────
// OpenAI-compatible (OpenAI, Azure, OpenRouter, vLLM, LM Studio, Ollama, etc.)
// ────────────────────────────────────────────────────────────
async function callOpenAICompatible(
  provider: AiProviderConfig,
  messages: LLMMessage[],
  opts: { temperature?: number }
): Promise<LLMResult> {
  const base = (provider.baseUrl || defaultBaseUrl("openai")).replace(/\/$/, "");
  const url = `${base}/chat/completions`;
  const body = JSON.stringify({
    model: provider.model,
    messages,
    temperature: opts.temperature ?? 0.4,
  });

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let errorMsg = `OpenAI-compatible API error ${res.status}: ${txt.slice(0, 300)}`;
    if (res.status === 400 && txt.includes("not a valid model")) {
      errorMsg = `شناسه مدل "${provider.model}" برای این ارائه‌دهنده معتبر نیست.`;
    }
    throw new Error(errorMsg);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  const tokens = data?.usage?.total_tokens ?? Math.ceil(content.length / 4);
  return { content, tokens };
}

// ────────────────────────────────────────────────────────────
// Anthropic (Claude)
// ────────────────────────────────────────────────────────────
async function callAnthropic(
  provider: AiProviderConfig,
  messages: LLMMessage[],
  opts: { temperature?: number }
): Promise<LLMResult> {
  const base = (provider.baseUrl || defaultBaseUrl("anthropic")).replace(/\/$/, "");
  const url = `${base}/messages`;
  // Anthropic separates system prompt from messages
  const systemMsg = messages.find((m) => m.role === "system");
  const convo = messages.filter((m) => m.role !== "system");
  const body = JSON.stringify({
    model: provider.model,
    max_tokens: 1024,
    temperature: opts.temperature ?? 0.4,
    system: systemMsg?.content || undefined,
    messages: convo.map((m) => ({ role: m.role, content: m.content })),
  });

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.content?.[0]?.text?.trim() || "";
  const inputTokens = data?.usage?.input_tokens ?? 0;
  const outputTokens = data?.usage?.output_tokens ?? Math.ceil(content.length / 4);
  const tokens = inputTokens + outputTokens;
  return { content, tokens };
}

// ────────────────────────────────────────────────────────────
// Google Gemini
// ────────────────────────────────────────────────────────────
async function callGemini(
  provider: AiProviderConfig,
  messages: LLMMessage[],
  opts: { temperature?: number }
): Promise<LLMResult> {
  const base = (provider.baseUrl || defaultBaseUrl("gemini")).replace(/\/$/, "");
  const url = `${base}/models/${provider.model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  // Gemini uses "contents" with parts; system instruction supported via systemInstruction
  const systemMsg = messages.find((m) => m.role === "system");
  const convo = messages.filter((m) => m.role !== "system");
  const body: any = {
    contents: convo.map((m, i) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: opts.temperature ?? 0.4, maxOutputTokens: 1024 },
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }
  const bodyStr = JSON.stringify(body);

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const tokens = data?.usageMetadata?.totalTokenCount ?? Math.ceil(content.length / 4);
  return { content, tokens };
}

// Test a provider connection with a tiny prompt. Returns ok + sample reply.
// Logs complete request/response details for debugging on the server side.
export async function testProvider(provider: AiProviderConfig): Promise<{ ok: boolean; reply: string; error?: string }> {
  const LOG_PREFIX = `[testProvider:${provider.type}/${provider.model}]`;
  console.log(`${LOG_PREFIX} ===== START TEST =====`);
  try {
    const messages: LLMMessage[] = [
      { role: "system", content: "You are a test assistant. Reply with exactly: OK" },
      { role: "user", content: "ping" },
    ];

    const result = await callLLM(provider, messages, { temperature: 0 });
    return { ok: !!result.content, reply: result.content.slice(0, 200) };
  } catch (e: any) {
    const errorMsg = e.message || String(e);
    console.error(`${LOG_PREFIX} Test FAILED: ${errorMsg}`);
    return { ok: false, reply: "", error: errorMsg };
  }
}

// Provider metadata for UI
export const PROVIDER_TYPES: { code: ProviderType; label: string; desc: string; defaultModel: string; needsBaseUrl: boolean; needsKey: boolean }[] = [
  { code: "openai", label: "OpenAI", desc: "GPT-4o, GPT-4o-mini, GPT-4 Turbo و سایر مدل‌های OpenAI", defaultModel: "gpt-4o-mini", needsBaseUrl: false, needsKey: true },
  { code: "openrouter", label: "OpenRouter", desc: "OpenRouter: دسترسی به ۲۰۰+ مدل از طریق یک API (Claude, GPT, Gemini, Llama و ...)", defaultModel: "openai/gpt-4o-mini", needsBaseUrl: false, needsKey: true },
  { code: "anthropic", label: "Anthropic (Claude)", desc: "Claude 3.5 Sonnet, Haiku, Opus", defaultModel: "claude-3-5-sonnet-20241022", needsBaseUrl: false, needsKey: true },
  { code: "gemini", label: "Google Gemini", desc: "Gemini 1.5 Pro / Flash", defaultModel: "gemini-1.5-flash", needsBaseUrl: false, needsKey: true },
  { code: "custom", label: "سازگار با OpenAI (سفارشی)", desc: "هر endpoint سازگار با OpenAI: Azure، OpenRouter، vLLM، Ollama، LM Studio", defaultModel: "llama3.1", needsBaseUrl: true, needsKey: true },
  { code: "zai", label: "پلتفرم پیش‌فرض (Z.ai)", desc: "استفاده از موتور پیش‌فرض پلتفرم بدون نیاز به کلید API", defaultModel: "glm-4.6", needsBaseUrl: false, needsKey: false },
];
