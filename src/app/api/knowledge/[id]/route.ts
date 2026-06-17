import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// DELETE a knowledge item — requires ?tenantId= and verifies ownership (isolation)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  // Verify ownership before deleting
  const item = await db.knowledgeItem.findFirst({ where: { id, tenantId } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.knowledgeItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
