import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "all";
  const q = searchParams.get("q") || "";

  const where: any = { status: "active" };
  if (category && category !== "all") where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const tenants = await db.tenant.findMany({
    where,
    include: { agent: true },
    orderBy: { createdAt: "desc" },
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
