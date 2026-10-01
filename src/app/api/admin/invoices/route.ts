import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";

// GET /api/admin/invoices — all invoices across all tenants (for Super Admin)
export async function GET(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: any = {};
  if (status && status !== "all") where.status = status;

  const invoices = await db.invoice.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true, slug: true, accentColor: true } },
      plan: { select: { id: true, name: true, code: true, priceMonthly: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(invoices);
}
