import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/admin/leads — all leads across all tenants (for Super Admin)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const leads = await db.lead.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true, slug: true, accentColor: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(leads);
}
