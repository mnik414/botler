import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH a lead — requires ?tenantId= and verifies ownership (isolation)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  // Verify ownership
  const lead = await db.lead.findFirst({ where: { id, tenantId } });
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const allowed = ["status", "intent", "name", "phone", "email", "value"];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  const updated = await db.lead.update({ where: { id }, data });
  return NextResponse.json(updated);
}
