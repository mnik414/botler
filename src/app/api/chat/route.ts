import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runReceptionist, detectBooking } from "@/lib/ai-engine";
import type { ChatMessage } from "@/lib/types";
import { checkQuota, reserveMessages, recordUsage } from "@/lib/quota";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

const MAX_MESSAGE_LEN = 2000;
const MAX_HISTORY = 20;

function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const history: ChatMessage[] = [];
  for (const item of raw.slice(-MAX_HISTORY)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as any).role;
    const content = (item as any).content;
    // `operator` is intentionally dropped: clients must not be able to forge
    // privileged human turns in the model context.
    if ((role === "user" || role === "assistant") && typeof content === "string" && content.length > 0) {
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

    const { tenantId, conversationId, message, history, trackToken, clientMessageId } = body;
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

    // Ensure conversation exists — scoped to the same tenant (isolation).
    // Resuming an existing conversation requires its secret trackToken so a
    // leaked/guessed conversation id cannot be hijacked or its token disclosed.
    let convo = conversationId
      ? await db.conversation.findFirst({ where: { id: String(conversationId), tenantId } })
      : null;
    if (convo) {
      if (!trackToken || typeof trackToken !== "string" || convo.trackToken !== trackToken) {
        return NextResponse.json({ error: "برای ادامه گفتگو، شناسه گفتگو نامعتبر است" }, { status: 403 });
      }
    } else {
      convo = await db.conversation.create({
        data: {
          tenantId,
          channel: "widget",
          status: "ai",
          endUserName: "مهمان",
          trackToken: randomBytes(16).toString("hex"),
        },
      });
      // Count the new conversation against the monthly conversation quota.
      await recordUsage(tenantId, { conversations: 1 });
    }

    // Idempotency: a retried request with the same client message id returns
    // the previously generated reply instead of double-charging the LLM.
    const clientKey = typeof clientMessageId === "string" && clientMessageId.length > 0 ? clientMessageId.slice(0, 100) : null;
    if (clientKey) {
      const existingMsg = await db.message.findUnique({
        where: { conversationId_clientKey: { conversationId: convo.id, clientKey } },
      });
      if (existingMsg) {
        const replyMsg = await db.message.findFirst({
          where: { conversationId: convo.id, role: "assistant", createdAt: { gte: existingMsg.createdAt } },
          orderBy: { createdAt: "asc" },
        });
        return NextResponse.json({
          conversationId: convo.id,
          trackToken: convo.trackToken,
          reply: replyMsg?.content || "",
          confidence: replyMsg?.confidence || 0,
          sources: [],
          handoff: replyMsg?.handoff || false,
          lead: { detected: false },
          growth: { isBusinessOwner: false, score: 0, signals: [] },
          leadCreated: null,
          bookingCreated: null,
          tokens: 0,
          duplicate: true,
        });
      }
    }

    // Atomically reserve one message before any LLM spend (TOCTOU-safe).
    const reserved = await reserveMessages(tenantId, 1);
    if (!reserved.ok) {
      return NextResponse.json({ error: reserved.reason || "سهمیه پاسخگویی به پایان رسیده است" }, { status: 429 });
    }

    await db.message.create({
      data: {
        conversationId: convo.id,
        role: "user",
        content: message.slice(0, MAX_MESSAGE_LEN),
        clientKey,
      },
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
        model: tenant.agent.model,
        aiProviderId: tenant.agent.aiProviderId,
      },
      businessName: tenant.name,
      businessType: tenant.businessType,
      history: sanitizeHistory(history),
      userMessage: message,
    });

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

    // Lead capture (deduplicated by phone per tenant).
    // `leadCreated` is bound to the conversation's first capture — not to
    // whether the phone already exists in the CRM — so the public endpoint
    // cannot be used as a phone-number existence oracle.
    let leadCreated: any = null;
    const hadLeadBefore = convo.leadCaptured;
    const leadPhone = result.lead.phone ? result.lead.phone.replace(/[^\d+]/g, "").slice(0, 20) : "";
    if (result.lead.detected && leadPhone) {
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
        // Do not steal the original conversation link from the lead.
        update: {},
        select: { id: true, name: true },
      });
      if (!hadLeadBefore) leadCreated = lead;
      await db.conversation.update({
        where: { id: convo.id },
        data: { leadCaptured: true, endUserPhone: leadPhone },
      });
    }

    if (result.handoff) {
      await db.conversation.update({
        where: { id: convo.id },
        data: { status: "handoff", confidence: result.confidence },
      });
    }

    // Booking / sales intent detection → deduped via unique dedupeKey.
    let bookingCreated: any = null;
    const booking = detectBooking(message);
    if (booking.detected && booking.type) {
      const bookingLabels: Record<string, string> = {
        order: "سفارش",
        reservation: "رزرو",
        appointment: "نوبت",
        callback: "درخواست تماس",
      };
      try {
        const bookingRecord = await db.booking.create({
          data: {
            tenantId,
            conversationId: convo.id,
            leadId: leadCreated?.id || null,
            type: booking.type,
            dedupeKey: `${convo.id}:${booking.type}`,
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
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
        // Re-open a previously cancelled booking for the same intent.
        const dedupeKey = `${convo.id}:${booking.type}`;
        const existing = await db.booking.findUnique({ where: { dedupeKey }, select: { id: true, status: true } });
        if (existing?.status === "cancelled") {
          await db.booking.update({
            where: { id: existing.id },
            data: {
              status: "pending",
              payloadJson: JSON.stringify({
                details: booking.details,
                label: bookingLabels[booking.type],
                endUserName: result.lead.name || "مهمان",
                endUserPhone: leadPhone,
                capturedAt: new Date().toISOString(),
              }),
            },
          });
          bookingCreated = { id: existing.id, type: booking.type, label: bookingLabels[booking.type] };
        }
      }
    }

    // Growth-loop internal lead (unique per tenant+conversation)
    if (result.growth.isBusinessOwner) {
      try {
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
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
      }
    }

    // Usage accounting: message counter was reserved above; record tokens only.
    await recordUsage(tenantId, { tokens: result.tokens, feature: "chat", model: tenant.agent.model });
    await db.conversation.update({
      where: { id: convo.id },
      data: { confidence: result.confidence, messageCount: { increment: 2 } },
    });

    return NextResponse.json({
      conversationId: convo.id,
      trackToken: convo.trackToken,
      reply: result.reply,
      confidence: result.confidence,
      // Never expose stored chunks/snippets publicly; titles only.
      sources: result.sources.map((s) => ({ id: s.id, title: s.title, snippet: "", score: s.score })),
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
