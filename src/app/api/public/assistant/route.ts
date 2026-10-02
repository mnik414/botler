import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";
import { BOTLER_TENANT_SLUG } from "@/lib/botler";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

// GET /api/public/assistant — public projection of Botler's own receptionist.
// The marketing site uses it to render the platform's assistant (floating
// widget, live demo) instead of any customer business.
export async function GET(req: Request) {
  const limit = rateLimit(`assistant-public:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const tenant = await db.tenant.findUnique({
    where: { slug: BOTLER_TENANT_SLUG },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      businessType: true,
      category: true,
      accentColor: true,
      instagram: true,
      phone: true,
      address: true,
      status: true,
      agent: { select: { name: true, greetingMessage: true } },
    },
  });

  if (!tenant || tenant.status !== "active") {
    return NextResponse.json({ error: "assistant not found" }, { status: 404 });
  }

  const bt = getBusinessType(tenant.businessType);
  return NextResponse.json({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    description: tenant.description,
    businessType: tenant.businessType,
    businessTypeLabel: bt.label,
    icon: bt.icon,
    category: tenant.category,
    accentColor: tenant.accentColor,
    instagram: tenant.instagram,
    phone: tenant.phone,
    address: tenant.address,
    agentName: tenant.agent?.name || null,
    greetingMessage: tenant.agent?.greetingMessage || null,
  });
}
