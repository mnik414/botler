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
  const completion = await zai.chat.completions.create({
    messages: mapped as any,
    thinking: { type: "disabled" },
  });
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

  console.log(`[openai-compat] POST ${url}`);
  console.log(`[openai-compat] Request body:`, body);
  console.log(`[openai-compat] Authorization: Bearer ${provider.apiKey ? provider.apiKey.slice(0, 12) + "..." : "(EMPTY)"}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body,
  });

  console.log(`[openai-compat] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[openai-compat] Error response body:`, txt);
    throw new Error(`OpenAI-compatible API error ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();
  console.log(`[openai-compat] Response body:`, JSON.stringify(data).slice(0, 1000));
  const content = data?.choices?.[0]?.message?.content?.trim() || "";
  const tokens = data?.usage?.total_tokens ?? Math.ceil(content.length / 4);
  console.log(`[openai-compat] Extracted content: "${content.slice(0, 100)}"`);
  console.log(`[openai-compat] Extracted tokens: ${tokens}`);
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

  console.log(`[anthropic] POST ${url}`);
  console.log(`[anthropic] Request body:`, body);
  console.log(`[anthropic] API Key prefix: ${provider.apiKey ? provider.apiKey.slice(0, 12) + "..." : "(EMPTY)"}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  console.log(`[anthropic] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[anthropic] Error response body:`, txt);
    throw new Error(`Anthropic API error ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();
  console.log(`[anthropic] Response body:`, JSON.stringify(data).slice(0, 1000));
  const content = data?.content?.[0]?.text?.trim() || "";
  const tokens = data?.usage?.output_tokens ?? Math.ceil(content.length / 4);
  console.log(`[anthropic] Extracted content: "${content.slice(0, 100)}"`);
  console.log(`[anthropic] Extracted tokens: ${tokens}`);
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

  console.log(`[gemini] POST ${url}`);
  console.log(`[gemini] Request body:`, bodyStr);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });

  console.log(`[gemini] Response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`[gemini] Error response body:`, txt);
    throw new Error(`Gemini API error ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = await res.json();
  console.log(`[gemini] Response body:`, JSON.stringify(data).slice(0, 1000));
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const tokens = data?.usageMetadata?.totalTokenCount ?? Math.ceil(content.length / 4);
  console.log(`[gemini] Extracted content: "${content.slice(0, 100)}"`);
  console.log(`[gemini] Extracted tokens: ${tokens}`);
  return { content, tokens };
}

// Test a provider connection with a tiny prompt. Returns ok + sample reply.
// Logs complete request/response details for debugging on the server side.
export async function testProvider(provider: AiProviderConfig): Promise<{ ok: boolean; reply: string; error?: string }> {
  const LOG_PREFIX = `[testProvider:${provider.type}/${provider.model}]`;
  console.log(`${LOG_PREFIX} ===== START TEST =====`);
  console.log(`${LOG_PREFIX} Provider config:`, {
    type: provider.type,
    model: provider.model,
    baseUrl: provider.baseUrl || defaultBaseUrl(provider.type) || "(none)",
    apiKeyPrefix: provider.apiKey ? provider.apiKey.slice(0, 12) + "..." : "(EMPTY - no API key set)",
  });

  try {
    const messages: LLMMessage[] = [
      { role: "system", content: "You are a test assistant. Reply with exactly: OK" },
      { role: "user", content: "ping" },
    ];

    console.log(`${LOG_PREFIX} Sending messages:`, JSON.stringify(messages));

    const result = await callLLM(provider, messages, { temperature: 0 });

    console.log(`${LOG_PREFIX} Test SUCCEEDED`);
    console.log(`${LOG_PREFIX}   Full reply: "${result.content}"`);
    console.log(`${LOG_PREFIX}   Reply length: ${result.content.length} chars`);
    console.log(`${LOG_PREFIX}   Tokens used: ${result.tokens}`);
    console.log(`${LOG_PREFIX} ===== END TEST (SUCCESS) =====`);

    return { ok: !!result.content, reply: result.content.slice(0, 200) };
  } catch (e: any) {
    const errorMsg = e.message || String(e);
    console.error(`${LOG_PREFIX} Test FAILED`);
    console.error(`${LOG_PREFIX}   Error message: "${errorMsg}"`);
    if (e.stack) {
      console.error(`${LOG_PREFIX}   Stack trace:\n${e.stack}`);
    }
    console.error(`${LOG_PREFIX} ===== END TEST (FAILURE) =====`);
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
