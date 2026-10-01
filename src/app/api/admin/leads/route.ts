import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";

// GET /api/admin/leads — all leads across all tenants (for Super Admin)
export async function GET(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const { limit, offset } = parsePagination(searchParams, { limit: 200, max: 500 });

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
    take: limit,
    skip: offset,
  });

  return NextResponse.json(leads);
}
