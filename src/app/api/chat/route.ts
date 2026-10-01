import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runReceptionist, detectBooking } from "@/lib/ai-engine";
import type { ChatMessage } from "@/lib/types";
import { checkQuota, recordUsage } from "@/lib/quota";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 20;

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").slice(0, 20);
}

function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const history: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as any).role;
    const content = (item as any).content;
    if ((role === "user" || role === "assistant" || role === "operator") && typeof content === "string" && content.length > 0) {
      history.push({ role, content: content.slice(0, MAX_MESSAGE_LEN), createdAt: new Date().toISOString() });
    }
  }
  return history;
}

// POST /api/chat — public endpoint used by the embeddable widget
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
    }

    const { tenantId, conversationId, message, history } = body;
    if (typeof tenantId !== "string" || typeof message !== "string" || !tenantId || !message.trim()) {
      return NextResponse.json({ error: "tenantId and message required" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: `متن پیام حداکثر ${MAX_MESSAGE_LEN} کاراکتر است` }, { status: 400 });
    }

    const ipLimit = rateLimit(`chat-ip:${clientIp(req)}`, 30, 60_000);
    if (!ipLimit.ok) return tooManyRequests(ipLimit.retryAfterSec);
    const tenantLimit = rateLimit(`chat-tenant:${tenantId}`, 240, 60_000);
    if (!tenantLimit.ok) return tooManyRequests(tenantLimit.retryAfterSec);

    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { agent: true } });
    if (!tenant || !tenant.agent) {
      return NextResponse.json({ error: "tenant or agent not found" }, { status: 404 });
    }
    if (tenant.status === "suspended") {
      return NextResponse.json({ error: "این کسب‌وکار موقتاً غیرفعال است" }, { status: 403 });
    }

    const quota = await checkQuota(tenantId);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.reason || "سهمیه پاسخگویی به پایان رسیده است" }, { status: 429 });
    }

    // Ensure conversation exists — scoped to the same tenant (isolation)
    let convo = conversationId
      ? await db.conversation.findFirst({ where: { id: String(conversationId), tenantId } })
      : null;
    if (!convo) {
      convo = await db.conversation.create({
        data: {
          tenantId,
          channel: "widget",
          status: "ai",
          endUserName: "مهمان",
          trackToken: randomBytes(16).toString("hex"),
        },
      });
    } else if (!convo.trackToken) {
      convo = await db.conversation.update({
        where: { id: convo.id },
        data: { trackToken: randomBytes(16).toString("hex") },
      });
    }

    // Persist user message
    await db.message.create({
      data: { conversationId: convo.id, role: "user", content: message.slice(0, MAX_MESSAGE_LEN) },
    });

    // Run the receptionist (RAG + LLM + lead + growth)
    const result = await runReceptionist({
      tenantId,
      agent: {
        systemPrompt: tenant.agent.systemPrompt,
        temperature: tenant.agent.temperature,
        confidenceThreshold: tenant.agent.confidenceThreshold,
        humanHandoff: tenant.agent.humanHandoff,
        growthLoop: tenant.agent.growthLoop,
        name: tenant.agent.name,
        aiProviderId: tenant.agent.aiProviderId,
      },
      businessName: tenant.name,
      businessType: tenant.businessType,
      history: sanitizeHistory(history),
      userMessage: message,
    });

    // Persist assistant message
    await db.message.create({
      data: {
        conversationId: convo.id,
        role: "assistant",
        content: result.reply,
        confidence: result.confidence,
        tokens: result.tokens,
        sourcesJson: JSON.stringify(result.sources.map((s) => s.id)),
        handoff: result.handoff,
      },
    });

    // Lead capture (deduplicated by phone per tenant)
    let leadCreated: any = null;
    const leadPhone = result.lead.phone ? normalizePhone(result.lead.phone) : "";
    if (result.lead.detected && leadPhone) {
      const existingLead = await db.lead.findUnique({
        where: { tenantId_phone: { tenantId, phone: leadPhone } },
        select: { id: true },
      });
      const lead = await db.lead.upsert({
        where: { tenantId_phone: { tenantId, phone: leadPhone } },
        create: {
          tenantId,
          conversationId: convo.id,
          name: (result.lead.name || "مهمان").slice(0, 200),
          phone: leadPhone,
          email: (result.lead.email || "").slice(0, 200),
          source: "chat",
          intent: "inquiry",
          status: "new",
        },
        update: { conversationId: convo.id },
        select: { id: true, name: true },
      });
      if (!existingLead) leadCreated = lead;
      await db.conversation.update({
        where: { id: convo.id },
        data: { leadCaptured: true, endUserPhone: leadPhone },
      });
    }

    // Handoff → set conversation status
    if (result.handoff) {
      await db.conversation.update({
        where: { id: convo.id },
        data: { status: "handoff", confidence: result.confidence },
      });
    }

    // Booking / sales intent detection → create a Booking record (deduped per conversation+type)
    let bookingCreated: any = null;
    const booking = detectBooking(message);
    if (booking.detected && booking.type) {
      const bookingLabels: Record<string, string> = {
        order: "سفارش",
        reservation: "رزرو",
        appointment: "نوبت",
        callback: "درخواست تماس",
      };
      const existingBooking = await db.booking.findFirst({
        where: { conversationId: convo.id, type: booking.type, status: { not: "cancelled" } },
        select: { id: true },
      });
      if (!existingBooking) {
        const bookingRecord = await db.booking.create({
          data: {
            tenantId,
            conversationId: convo.id,
            leadId: leadCreated?.id || null,
            type: booking.type,
            payloadJson: JSON.stringify({
              details: booking.details,
              label: bookingLabels[booking.type],
              endUserName: result.lead.name || "مهمان",
              endUserPhone: leadPhone,
              capturedAt: new Date().toISOString(),
            }),
            status: "pending",
          },
        });
        bookingCreated = { id: bookingRecord.id, type: booking.type, label: bookingLabels[booking.type] };
      }
    }

    // Growth-loop internal lead
    if (result.growth.isBusinessOwner) {
      const ex = await db.internalLead.findFirst({
        where: { tenantId, conversationId: convo.id },
        select: { id: true },
      });
      if (!ex) {
        await db.internalLead.create({
          data: {
            tenantId,
            conversationId: convo.id,
            endUserName: "کاربر نهایی",
            signal: "business_owner_signal",
            score: result.growth.score,
            status: "new",
          },
        });
      }
    }

    // Usage accounting (tokens + one user message)
    await recordUsage(tenantId, { tokens: result.tokens, messages: 1, feature: "chat" });
    await db.conversation.update({
      where: { id: convo.id },
      data: { confidence: result.confidence, messageCount: { increment: 2 } },
    });

    return NextResponse.json({
      conversationId: convo.id,
      trackToken: convo.trackToken,
      reply: result.reply,
      confidence: result.confidence,
      sources: result.sources,
      handoff: result.handoff,
      lead: result.lead,
      growth: result.growth,
      leadCreated: leadCreated ? { id: leadCreated.id, name: leadCreated.name } : null,
      bookingCreated,
      tokens: result.tokens,
    });
  } catch (e: any) {
    console.error("[chat] error", e);
    return NextResponse.json({ error: "خطای سرور در پردازش پیام" }, { status: 500 });
  }
}
