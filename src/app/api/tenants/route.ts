import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";
import { buildChunks } from "@/lib/ai-engine";
import { isResponse, requireRole } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SELF_SERVE_PLANS = ["starter", "growth", "business"];
const REFERRAL_SIGNUP_CREDITS = 100_000;
const REFERRAL_SIGNUP_COMMISSION = 50_000;

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || `biz-${randomBytes(4).toString("hex")}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let i = 1; await db.tenant.findUnique({ where: { slug: candidate }, select: { id: true } }); i++) {
    candidate = i > 20 ? `${base.slice(0, 30)}-${randomBytes(3).toString("hex")}` : `${base.slice(0, 35)}-${i}`;
  }
  return candidate;
}

async function uniqueReferralCode(base: string): Promise<string> {
  const normalized = base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || randomBytes(4).toString("hex").toUpperCase();
  let candidate = normalized;
  for (let i = 1; await db.referral.findUnique({ where: { code: candidate }, select: { id: true } }); i++) {
    candidate = `${normalized.slice(0, 5)}${randomBytes(2).toString("hex").toUpperCase()}`;
    if (i > 20) break;
  }
  return candidate;
}

// List tenants (super admin only)
export async function GET(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const tenants = await db.tenant.findMany({
    include: {
      plan: true,
      subscription: true,
      agent: true,
      _count: { select: { conversations: true, leads: true, knowledge: true, users: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json(tenants);
}

// Register a new business — public signup endpoint
export async function POST(req: Request) {
  try {
    const limit = rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60_000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "تعداد ثبت‌نام‌ها از این IP بیش از حد مجاز است.");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
    }

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
      ownerPassword,
      referralCode,
    } = body;

    if (typeof businessType !== "string" || typeof name !== "string" || typeof ownerEmail !== "string" || typeof ownerPassword !== "string") {
      return NextResponse.json({ error: "اطلاعات ثبت‌نام کامل نیست" }, { status: 400 });
    }
    if (!businessType || !name.trim() || !ownerEmail.trim()) {
      return NextResponse.json({ error: "businessType, name, ownerEmail are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return NextResponse.json({ error: "ایمیل معتبر وارد کنید" }, { status: 400 });
    }
    if (ownerPassword.length < 8) {
      return NextResponse.json({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد" }, { status: 400 });
    }
    if (!SELF_SERVE_PLANS.includes(planCode)) {
      return NextResponse.json({ error: "این پلن از طریق ثبت‌نام آنلاین قابل انتخاب نیست" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({ where: { email: ownerEmail.toLowerCase().trim() }, select: { id: true } });
    if (existingUser) return NextResponse.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });

    const bt = getBusinessType(businessType);
    const plan = await db.plan.findUnique({ where: { code: planCode } });
    if (!plan) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

    const slug = await uniqueSlug(slugify(name));
    const referralCodeToUse = await uniqueReferralCode(slug);

    let referrer: { id: string } | null = null;
    if (typeof referralCode === "string" && referralCode.trim()) {
      referrer = await db.referral.findUnique({
        where: { code: referralCode.trim().toUpperCase().slice(0, 32) },
        select: { id: true },
      });
    }

    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const now = new Date();

    const { tenant, agent } = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: name.trim().slice(0, 200),
          businessType,
          description: typeof description === "string" ? description.slice(0, 2000) : "",
          website: typeof website === "string" ? website.slice(0, 500) : "",
          instagram: typeof instagram === "string" ? instagram.slice(0, 200) : "",
          whatsapp: typeof whatsapp === "string" ? whatsapp.slice(0, 50) : "",
          phone: typeof phone === "string" ? phone.slice(0, 50) : "",
          address: typeof address === "string" ? address.slice(0, 500) : "",
          accentColor:
            bt.code === "store" ? "#8b5cf6" :
            bt.code === "restaurant" ? "#f59e0b" :
            bt.code === "doctor" || bt.code === "clinic" ? "#0ea5e9" :
            bt.code === "travel" || bt.code === "hotel" ? "#ec4899" :
            bt.code === "academy" ? "#14b8a6" : "#10b981",
          category: bt.category,
          planId: plan.id,
          status: "active",
        },
      });

      await tx.user.create({
        data: {
          email: ownerEmail.toLowerCase().trim(),
          name: typeof ownerName === "string" && ownerName.trim() ? ownerName.trim().slice(0, 200) : `مدیر ${tenant.name}`,
          role: "business_owner",
          tenantId: tenant.id,
          passwordHash,
        },
      });

      const agent = await tx.agent.create({
        data: {
          tenantId: tenant.id,
          name: `منشی ${tenant.name}`,
          systemPrompt: bt.prompt,
          greetingMessage: `سلام! من منشی هوشمند ${tenant.name} هستم. چطور می‌توانم کمکتان کنم؟`,
          channelsJson: JSON.stringify(["website", "widget", "instagram", "whatsapp"]),
          voiceEnabled: planCode === "business",
        },
      });

      for (const faq of bt.sampleFaqs) {
        const chunks = buildChunks(faq.a, faq.q);
        await tx.knowledgeItem.create({
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

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: "trial",
          renewsAt: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
        },
      });

      await tx.referral.create({
        data: { tenantId: tenant.id, code: referralCodeToUse },
      });

      if (referrer) {
        await tx.referral.update({
          where: { id: referrer.id },
          data: {
            signups: { increment: 1 },
            credits: { increment: REFERRAL_SIGNUP_CREDITS },
            commission: { increment: REFERRAL_SIGNUP_COMMISSION },
          },
        });
      }

      return { tenant, agent };
    });

    return NextResponse.json({ tenant, agent }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "این نام یا ایمیل قبلاً ثبت شده است. لطفاً نام دیگری انتخاب کنید." }, { status: 409 });
    }
    console.error("[tenants/POST]", e);
    return NextResponse.json({ error: "ثبت‌نام انجام نشد. لطفاً دوباره تلاش کنید." }, { status: 500 });
  }
}
