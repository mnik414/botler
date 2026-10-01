import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isResponse, requireTenantOwner } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  businessType: true,
  category: true,
  accentColor: true,
  logoUrl: true,
  website: true,
  instagram: true,
  whatsapp: true,
  phone: true,
  address: true,
  status: true,
  createdAt: true,
} as const;

// Returns public business info to anonymous callers; full (minus secrets/users)
// info to members of the tenant or super admins.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getAuthUser(req);
  // Plan/subscription details are owner-level; operators get the public projection.
  const isOwner = !!user && (user.role === "super_admin" || (user.role === "business_owner" && user.tenantId === id));

  if (isOwner) {
    const tenant = await db.tenant.findUnique({
      where: { id },
      select: {
        ...PUBLIC_SELECT,
        plan: true,
        subscription: { include: { plan: true } },
        agent: { select: { id: true, name: true, greetingMessage: true, voiceEnabled: true } },
      },
    });
    if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(tenant);
  }

  const limit = rateLimit(`tenant-public:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const tenant = await db.tenant.findUnique({ where: { id }, select: PUBLIC_SELECT });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

// PATCH /api/tenants/[id] — owner (or super admin) updates business profile
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireTenantOwner(req, id);
  if (isResponse(auth)) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const stringFields = ["name", "description", "phone", "address", "instagram", "website", "logoUrl", "category"];
  const data: any = {};
  for (const k of stringFields) {
    if (typeof body[k] === "string") data[k] = body[k].slice(0, 2000);
  }
  if (typeof body.accentColor === "string" && /^#[0-9a-fA-F]{3,8}$/.test(body.accentColor)) {
    data.accentColor = body.accentColor;
  }
  if ("status" in body && auth.user.role === "super_admin" && typeof body.status === "string") {
    if (["active", "suspended", "trial"].includes(body.status)) data.status = body.status;
  }

  const existing = await db.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "کسب‌وکار یافت نشد" }, { status: 404 });

  const tenant = await db.tenant.update({
    where: { id },
    data,
    select: { ...PUBLIC_SELECT, plan: true, subscription: { include: { plan: true } } },
  });
  return NextResponse.json(tenant);
}
