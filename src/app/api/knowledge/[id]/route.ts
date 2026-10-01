import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenantOwner } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const auth = await requireTenantOwner(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const item = await db.knowledgeItem.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.knowledgeItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
