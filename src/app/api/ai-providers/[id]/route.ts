import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// DELETE /api/ai-providers/[id]?tenantId=... — SUPER ADMIN ONLY
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["super_admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const provider = await db.aiProvider.findFirst({ where: { id, tenantId } });
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });

  await db.agent.updateMany({ where: { tenantId, aiProviderId: id }, data: { aiProviderId: null } });
  await db.aiProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/ai-providers/[id]?tenantId=... — SUPER ADMIN ONLY (update + activate/deactivate)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["super_admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const provider = await db.aiProvider.findFirst({ where: { id, tenantId } });
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: any = {};
  for (const k of ["name", "type", "apiKey", "baseUrl", "model", "isActive"]) {
    if (k in body) data[k] = body[k];
  }

  if (body.activate === true) {
    await db.agent.update({ where: { tenantId }, data: { aiProviderId: id } });
    return NextResponse.json({ ok: true, active: true });
  }
  if (body.deactivate === true) {
    await db.agent.updateMany({ where: { tenantId, aiProviderId: id }, data: { aiProviderId: null } });
    return NextResponse.json({ ok: true, active: false });
  }

  const updated = await db.aiProvider.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, type: updated.type, model: updated.model });
}
