import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/pagination";

export async function GET(req: Request) {
  const rate = rateLimit(`marketplace:${clientIp(req)}`, 60, 60_000);
  if (!rate.ok) return tooManyRequests(rate.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "all").slice(0, 50);
  const q = (searchParams.get("q") || "").slice(0, 100);
  const { limit, offset } = parsePagination(searchParams, { limit: 200, max: 200 });

  const where: any = { status: "active" };
  if (category && category !== "all") where.category = category;
  if (q) {
    where.OR = [{ name: { contains: q } }, { description: { contains: q } }];
  }

  const tenants = await db.tenant.findMany({
    where,
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
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  const result = tenants.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    description: t.description,
    businessType: t.businessType,
    businessTypeLabel: getBusinessType(t.businessType).label,
    icon: getBusinessType(t.businessType).icon,
    category: t.category,
    accentColor: t.accentColor,
    instagram: t.instagram,
    phone: t.phone,
    address: t.address,
  }));

  return NextResponse.json(result);
}
