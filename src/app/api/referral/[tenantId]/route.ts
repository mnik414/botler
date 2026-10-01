import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = await requireTenantOwner(req, tenantId);
  if (isResponse(auth)) return auth;

  const referral = await db.referral.findUnique({ where: { tenantId: auth.tenantId } });
  if (!referral) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(referral);
}
