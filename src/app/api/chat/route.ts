import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runReceptionist, detectBooking } from "@/lib/ai-engine";
import type { ChatMessage } from "@/lib/types";

// POST /api/chat
// body: { tenantId, conversationId?, message, history: ChatMessage[] }
export async function POST(req: Request) {
  try {
    const { tenantId, conversationId, message, history = [] } = await req.json();
    if (!tenantId || !message) {
      return NextResponse.json({ error: "tenantId and message required" }, { status: 400 });
    }

    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, include: { agent: true } });
    if (!tenant || !tenant.agent) {
      return NextResponse.json({ error: "tenant or agent not found" }, { status: 404 });
    }

    // Ensure conversation exists — MUST be scoped to the same tenant (isolation)
    let convo = conversationId
      ? await db.conversation.findFirst({ where: { id: conversationId, tenantId } })
      : null;
    if (!convo) {
      convo = await db.conversation.create({
        data: {
          tenantId,
          channel: "widget",
          status: "ai",
          endUserName: "مهمان",
        },
      });
    }

    // Persist user message
    await db.message.create({
      data: { conversationId: convo.id, role: "user", content: message },
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
      },
      businessName: tenant.name,
      businessType: tenant.businessType,
      history: history as ChatMessage[],
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

    // Update conversation state
    let leadCreated = null;
    if (result.lead.detected && (result.lead.phone || result.lead.email)) {
      const existing = await db.lead.findFirst({
        where: { tenantId, phone: result.lead.phone || "" },
      });
      if (!existing && result.lead.phone) {
        leadCreated = await db.lead.create({
          data: {
            tenantId,
            conversationId: convo.id,
            name: result.lead.name || "مهمان",
            phone: result.lead.phone,
            email: result.lead.email || "",
            source: "chat",
            intent: "inquiry",
            status: "new",
          },
        });
        await db.conversation.update({ where: { id: convo.id }, data: { leadCaptured: true, endUserPhone: result.lead.phone } });
      }
    }

    // Handoff → set conversation status
    if (result.handoff) {
      await db.conversation.update({ where: { id: convo.id }, data: { status: "handoff", confidence: result.confidence } });
    }

    // Booking / sales intent detection → create a Booking record
    let bookingCreated = null;
    const booking = detectBooking(message);
    if (booking.detected && booking.type) {
      const bookingLabels: Record<string, string> = {
        order: "سفارش",
        reservation: "رزرو",
        appointment: "نوبت",
        callback: "درخواست تماس",
      };
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
            endUserPhone: result.lead.phone || "",
            capturedAt: new Date().toISOString(),
          }),
          status: "pending",
        },
      });
      bookingCreated = { id: bookingRecord.id, type: booking.type, label: bookingLabels[booking.type] };
    }

    // Growth-loop internal lead
    if (result.growth.isBusinessOwner) {
      const ex = await db.internalLead.findFirst({
        where: { tenantId, conversationId: convo.id },
      });
      if (!ex) {
        await db.internalLead.create({
          data: { tenantId, conversationId: convo.id, endUserName: "کاربر نهایی", signal: "business_owner_signal", score: result.growth.score, status: "new" },
        });
      }
    }

    // Token usage log
    await db.tokenUsageLog.create({
      data: { tenantId, tokens: result.tokens, feature: "chat" },
    });
    await db.subscription.updateMany({
      where: { tenantId },
      data: { messageUsage: { increment: 1 }, tokenUsage: { increment: result.tokens } },
    });
    await db.conversation.update({
      where: { id: convo.id },
      data: { confidence: result.confidence, messageCount: { increment: 2 } },
    });

    return NextResponse.json({
      conversationId: convo.id,
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
    console.error("chat error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
