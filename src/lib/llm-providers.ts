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

// Hostname denylist covering IPv4 private/reserved ranges, IPv6 loopback/
// link-local/ULA/unspecified and IPv4-mapped IPv6 forms.
function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "::" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1) — Node normalizes to hex form.
  const mapped = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    const ip = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateHostname(ip);
  }

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT / cloud metadata
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  return false;
}

// SSRF guard for user-supplied provider base URLs. Note: DNS names that
// resolve to private IPs are additionally mitigated by disabling redirects at
// request time; full DNS rebinding protection requires a pinning agent.
export function validateBaseUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: "آدرس Base URL نامعتبر است" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Base URL نباید نام کاربری/رمز داشته باشد" };
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_AI_BASE_URL === "1";
  if (!allowPrivate) {
    if (parsed.protocol !== "https:") return { ok: false, error: "Base URL باید با https شروع شود" };
    if (isPrivateHostname(parsed.hostname)) return { ok: false, error: "آدرس‌های داخلی/خصوصی مجاز نیستند" };
  } else if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "پروتکل Base URL نامعتبر است" };
  }

  // Normalize: no query/fragment/userinfo, single trailing slash removal.
  parsed.search = "";
  parsed.hash = "";
  let normalized = parsed.toString().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(normalized)) {
    return { ok: false, error: "Base URL باید بدون مسیر chat/completions باشد" };
  }
  normalized = normalized.replace(/\/+$/, "");
  return { ok: true, url: normalized };
}

const LLM_TIMEOUT_MS = 45_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = LLM_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // redirect:"error" blocks redirect-based SSRF to internal endpoints.
    return await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJsonSafe(res: Response, providerLabel: string): Promise<any> {
  try {
    return await res.json();
  } catch {
    throw new Error(`${providerLabel} پاسخ JSON نامعتبر برگرداند`);
  }
}

function normalizeContent(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part: any) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  return "";
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
  // Keep the system role intact so grounding/security instructions are not
  // demoted to an assistant turn.
  const mapped = messages.map((m) => ({ role: m.role, content: m.content }));
  const completion = await withTimeout(
    zai.chat.completions.create({
      messages: mapped as any,
      thinking: { type: "disabled" },
      temperature: opts.temperature ?? 0.4,
    } as any),
    LLM_TIMEOUT_MS,
    "Z.ai completion"
  );
  const content = normalizeContent(completion.choices?.[0]?.message?.content);
  const usage = (completion as any)?.usage;
  const inputEstimate = Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4);
  const tokens =
    typeof usage?.total_tokens === "number" && usage.total_tokens > 0
      ? usage.total_tokens
      : inputEstimate + Math.ceil(content.length / 4);
  return { content, tokens };
}

// ────────────────────────────────────────────────────────────
// OpenAI-compatible (OpenAI, Azure, OpenRouter, vLLM, LM Studio, Ollama, etc.)
// ────────────────────────────────────────────────────────────
async function callOpenAICompatible(
  provider: AiProviderConfig,
  messages: LLMMessage[],
  opts: { temperature?: number }
): Promise<LLMResult> {
  const base = (provider.baseUrl || defaultBaseUrl(provider.type === "custom" ? "openai" : provider.type) || defaultBaseUrl("openai")).replace(/\/+$/, "");
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
  const data = await parseJsonSafe(res, "OpenAI-compatible API");
  const content = normalizeContent(data?.choices?.[0]?.message?.content);
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
  // Anthropic requires the first message to have role "user".
  const convo = messages.filter((m) => m.role !== "system");
  while (convo.length && convo[0].role === "assistant") convo.shift();
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
  const data = await parseJsonSafe(res, "Anthropic API");
  const content = normalizeContent(data?.content?.[0]?.text);
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
  // Gemini requires the first content to have role "user".
  const convo = messages.filter((m) => m.role !== "system");
  while (convo.length && convo[0].role === "assistant") convo.shift();
  const body: any = {
    contents: convo.map((m) => ({
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
  const data = await parseJsonSafe(res, "Gemini API");
  const content = normalizeContent(data?.candidates?.[0]?.content?.parts?.[0]?.text);
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
