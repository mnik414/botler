import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";

// GET /api/billing/invoices?tenantId= — invoices for the tenant
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await requireTenantOwner(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const invoices = await db.invoice.findMany({
    where: { tenantId: auth.tenantId },
    include: { plan: { select: { id: true, name: true, code: true, priceMonthly: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(invoices);
}
