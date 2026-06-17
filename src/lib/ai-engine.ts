import { db } from "@/lib/db";
import type { ChatMessage, ChatResult, GrowthSignal, KnowledgeChunk, LeadCapture, RagResult, RagSource } from "@/lib/types";

// ────────────────────────────────────────────────────────────
// Lightweight RAG: keyword-overlap retrieval over knowledge chunks.
// In production this would use vector embeddings (Qdrant), but the
// pipeline (chunk → embed → retrieve → inject → LLM) is identical.
// ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "و", "در", "به", "از", "که", "این", "را", "با", "است", "برای", "یک", "های", "یا",
  "the", "a", "an", "is", "are", "of", "to", "in", "on", "for", "and", "or", "what",
  "how", "much", "؟", "?", ".", ",", "،",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function chunkText(text: string, maxLen = 280): KnowledgeChunk[] {
  const paragraphs = text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: KnowledgeChunk[] = [];
  let buffer = "";
  for (const p of paragraphs) {
    if ((buffer + " " + p).length > maxLen && buffer) {
      chunks.push({ text: buffer.trim(), keywords: tokenize(buffer) });
      buffer = p;
    } else {
      buffer = buffer ? buffer + " " + p : p;
    }
  }
  if (buffer.trim()) chunks.push({ text: buffer.trim(), keywords: tokenize(buffer) });
  return chunks;
}

export function buildChunks(content: string, question?: string): KnowledgeChunk[] {
  const chunks = chunkText(content);
  if (question) {
    chunks.unshift({ text: `سوال: ${question}\nپاسخ: ${content}`, keywords: tokenize(question + " " + content) });
  }
  return chunks;
}

// BM25-ish keyword overlap score
function scoreChunk(queryTokens: string[], chunk: KnowledgeChunk): number {
  if (!chunk.keywords.length) return 0;
  let score = 0;
  const set = new Set(chunk.keywords);
  for (const t of queryTokens) {
    if (set.has(t)) score += 2;
    else if (chunk.keywords.some((k) => k.includes(t) || t.includes(k))) score += 1;
  }
  return score / Math.sqrt(chunk.keywords.length + 1);
}

export async function retrieve(tenantId: string, query: string, topK = 3): Promise<RagResult> {
  const items = await db.knowledgeItem.findMany({
    where: { tenantId, status: "ready" },
    select: { id: true, title: true, content: true, question: true, type: true, chunksJson: true },
  });

  const queryTokens = tokenize(query);
  if (!queryTokens.length) return { sources: [], context: "", topScore: 0 };

  const scored: RagSource[] = [];
  for (const item of items) {
    let chunks: KnowledgeChunk[] = [];
    try {
      chunks = JSON.parse(item.chunksJson || "[]");
    } catch {
      chunks = [];
    }
    if (!chunks.length && item.content) chunks = buildChunks(item.content, item.question || undefined);

    let best = 0;
    let bestText = item.content;
    for (const c of chunks) {
      const s = scoreChunk(queryTokens, c);
      if (s > best) {
        best = s;
        bestText = c.text;
      }
    }
    if (best > 0) {
      scored.push({
        id: item.id,
        title: item.question ? `${item.question}` : item.title,
        snippet: bestText.slice(0, 240),
        score: Number(best.toFixed(3)),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topK);
  const context = top.map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}`).join("\n\n");
  return { sources: top, context, topScore: top[0]?.score ?? 0 };
}

// ────────────────────────────────────────────────────────────
// Lead & growth-loop detection from user message
// ────────────────────────────────────────────────────────────
const PHONE_RE = /(\+?98|0)?9\d{9}|(\+?98|0)?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const NAME_HINTS = /(اسمم|نامم|من\s+.+هستم|به\s+نام|اینجانب)/i;

const GROWTH_KEYWORDS = [
  "فروشگاه دارم", "پیج اینستاگرام دارم", "کسب و کار", "کسب‌وکار", "شرکت دارم",
  "مشتری زیاد دارم", "پاسخگویی سخت", "واتساپ شلوغ", "منشی می‌خوام", "منشی می‌خواهم",
  "دیتا بیز", "خودم فروشنده", "آماده استفاده", "چت بات", "ربات پاسخگو", "اپلیکیشن می‌خوام",
  "دیجیتال مارکتینگ", "بیزینس",
];

export function detectLead(message: string): LeadCapture {
  const phone = message.match(PHONE_RE)?.[0];
  const email = message.match(EMAIL_RE)?.[0];
  const nameHint = message.match(NAME_HINTS);
  let name: string | undefined;
  if (nameHint) {
    const after = message.split(nameHint[0])[1]?.split(/[،,.!?]|\sو\s/)[0]?.trim();
    if (after && after.length < 30) name = after;
  }
  return { name, phone, email, detected: !!(phone || email || name) };
}

export function detectGrowth(message: string): GrowthSignal {
  const lower = message.toLowerCase();
  const signals: string[] = [];
  for (const kw of GROWTH_KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) signals.push(kw);
  }
  const score = Math.min(100, 25 + signals.length * 25);
  return { isBusinessOwner: signals.length >= 2, score, signals };
}

// ────────────────────────────────────────────────────────────
// The AI Receptionist chat engine — combines RAG + LLM + lead/growth
// ────────────────────────────────────────────────────────────
export async function runReceptionist(opts: {
  tenantId: string;
  agent: {
    systemPrompt: string;
    temperature: number;
    confidenceThreshold: number;
    humanHandoff: boolean;
    growthLoop: boolean;
    name: string;
  };
  businessName: string;
  businessType: string;
  history: ChatMessage[];
  userMessage: string;
}): Promise<ChatResult> {
  const { tenantId, agent, businessName, businessType, history, userMessage } = opts;

  // 1. Retrieve knowledge (RAG)
  const rag = await retrieve(tenantId, userMessage, 3);

  // 2. Confidence: based on retrieval score + message clarity
  let confidence = 0.4;
  if (rag.topScore > 0) confidence = Math.min(0.95, 0.5 + rag.topScore * 0.4);
  const isGreeting = /^(سلام|درود|hi|hello|hey|به\s+نام)/i.test(userMessage.trim());
  if (isGreeting) confidence = 0.7;

  // 3. Lead & growth detection
  const lead = detectLead(userMessage);
  const growth = agent.growthLoop ? detectGrowth(userMessage) : { isBusinessOwner: false, score: 0, signals: [] };

  // 4. Build the augmented system prompt
  const knowledgeBlock = rag.context
    ? `\n\n📌 دانش کسب‌وکار ( فقط از این منابع استفاده کن، اگر پاسخ در آن نبود صادقانه بگو):\n${rag.context}\n`
    : "\n\n📌 منبع دانش مرتبطی یافت نشد. اگر مطمئن نیستی، بگو که اپراتور را وارد می‌کنی.\n";

  const leadInstruction = `\n📋 اگر کاربر نام، شماره موبایل یا ایمیل داد، آن را تأیید کن و ذخیره کن. برای ثبت سفارش/رزرو/نوبت این سه مورد را بپرس: نام، شماره تماس، و جزئیات درخواست.`;

  const growthInstruction = agent.growthLoop
    ? `\n🌱 اگر کاربر نشان داد صاحب کسب‌وکار است (مثلاً می‌گوید فروشگاه دارد، پیج پرطرفداری دارد، پاسخگویی‌اش سخت شده)، پس از پاسخ به نیاز اصلی او، در یک جمله کوتاه و محترمانه پیشنهاد کن که این فناوری برای کسب‌وکارش هم کاربرد دارد. تبلیغ تهاجمی نکن.`
    : "";

  const fullSystem = `${agent.systemPrompt}\n\n🏢 کسب‌وکار: ${businessName} (نوع: ${businessType})\n Friendly persona name: ${agent.name}.${knowledgeBlock}${leadInstruction}${growthInstruction}\n\nقوانین:\n- فارسی، مودب و کوتاه پاسخ بده (حداکثر ۳ جمله مگر اینکه جزئیات لازم باشد).\n- فقط بر اساس دانش ارائه‌شده پاسخ بده؛ اگر مطمئن نیستی بگو «اجازه بده اپراتور را وارد کنم».\n- اطلاعات تماس مشتری را تأیید کن.`;

  // 5. Call LLM via z-ai-web-dev-sdk
  let reply = "";
  let tokens = 0;
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();
    const messages = [
      { role: "assistant", content: fullSystem } as const,
      ...history.slice(-8).map((m) => ({
        role: (m.role === "assistant" || m.role === "operator" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage } as const,
    ];
    const completion = await zai.chat.completions.create({
      messages: messages as any,
      thinking: { type: "disabled" },
    });
    reply = completion.choices[0]?.message?.content?.trim() || "";
    tokens = (reply.length / 4) | 0;
  } catch (e: any) {
    reply = "متأسفم، در لحظه پاسخگویی با مشکل مواجه شدم. لطفاً دوباره تلاش کنید یا با اپراتور صحبت کنید.";
    confidence = 0.2;
  }

  // 6. Handoff decision
  const handoff = agent.humanHandoff && confidence < agent.confidenceThreshold;

  return {
    reply,
    confidence: Number(confidence.toFixed(2)),
    sources: rag.sources,
    handoff,
    lead,
    growth,
    tokens,
  };
}

// ────────────────────────────────────────────────────────────
// Conversation analysis (frequent questions, intent, satisfaction)
// ────────────────────────────────────────────────────────────
export async function analyzeConversations(tenantId: string) {
  const convos = await db.conversation.findMany({
    where: { tenantId },
    include: { messages: { where: { role: "user" }, select: { content: true } } },
  });
  const freq: Record<string, number> = {};
  for (const c of convos) {
    for (const m of c.messages) {
      const tokens = tokenize(m.content);
      for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
    }
  }
  const topQuestions = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  const total = convos.length || 1;
  const handoffs = convos.filter((c) => c.status === "handoff").length;
  const leads = convos.filter((c) => c.leadCaptured).length;
  const avgSatisfaction =
    convos.reduce((s, c) => s + (c.satisfaction || 0), 0) / total;

  return {
    topQuestions,
    handoffRate: Number((handoffs / total).toFixed(2)),
    conversionRate: Number((leads / total).toFixed(2)),
    avgSatisfaction: Number(avgSatisfaction.toFixed(2)),
    totalConversations: convos.length,
  };
}
