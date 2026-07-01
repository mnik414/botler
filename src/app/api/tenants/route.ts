import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";
import { buildChunks } from "@/lib/ai-engine";
import bcrypt from "bcryptjs";

// List tenants (admin view)
export async function GET() {
  const tenants = await db.tenant.findMany({
    include: {
      plan: true,
      subscription: true,
      agent: true,
      _count: { select: { conversations: true, leads: true, knowledge: true, users: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tenants);
}

// Register a new business → auto-creates tenant + agent + knowledge seed + subscription
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      businessType,
      name,
      description = "",
      website = "",
      instagram = "",
      whatsapp = "",
      phone = "",
      address = "",
      planCode = "growth",
      ownerEmail,
      ownerName,
      ownerPassword = "demo123",
    } = body;

    if (!businessType || !name || !ownerEmail) {
      return NextResponse.json({ error: "businessType, name, ownerEmail are required" }, { status: 400 });
    }

    const bt = getBusinessType(businessType);
    const plan = await db.plan.findUnique({ where: { code: planCode } });
    if (!plan) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

    const slug = name.replace(/\s+/g, "-").toLowerCase();

    const tenant = await db.tenant.create({
      data: {
        slug,
        name,
        businessType,
        description,
        website,
        instagram,
        whatsapp,
        phone,
        address,
        accentColor: bt.code === "store" ? "#8b5cf6" : bt.code === "restaurant" ? "#f59e0b" : (bt.code === "doctor" || bt.code === "clinic") ? "#0ea5e9" : (bt.code === "travel" || bt.code === "hotel") ? "#ec4899" : bt.code === "academy" ? "#14b8a6" : "#10b981",
        category: bt.category,
        planId: plan.id,
        status: "active",
      },
    });

    // Owner user
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    await db.user.create({
      data: {
        email: ownerEmail,
        name: ownerName || `مدیر ${name}`,
        role: "business_owner",
        tenantId: tenant.id,
        passwordHash,
      },
    });

    // Auto-build agent from business type
    const agent = await db.agent.create({
      data: {
        tenantId: tenant.id,
        name: `منشی ${name}`,
        systemPrompt: bt.prompt,
        greetingMessage: `سلام! من منشی هوشمند ${name} هستم. چطور می‌توانم کمکتان کنم؟`,
        channelsJson: JSON.stringify(["website", "widget", "instagram", "whatsapp"]),
        voiceEnabled: planCode === "business" || planCode === "enterprise",
      },
    });

    // Seed sample FAQs as starter knowledge
    for (const faq of bt.sampleFaqs) {
      const chunks = buildChunks(faq.a, faq.q);
      await db.knowledgeItem.create({
        data: {
          tenantId: tenant.id,
          type: "faq",
          title: faq.q,
          question: faq.q,
          content: faq.a,
          chunksJson: JSON.stringify(chunks),
          status: "ready",
          size: faq.a.length,
        },
      });
    }

    // Subscription
    const now = new Date();
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: "trial",
        renewsAt: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
      },
    });

    // Referral
    await db.referral.create({
      data: {
        tenantId: tenant.id,
        code: slug.toUpperCase().replace(/-/g, "").slice(0, 8),
      },
    });

    return NextResponse.json({ tenant, agent }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
