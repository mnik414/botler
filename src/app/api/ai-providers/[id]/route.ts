import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

// DELETE /api/ai-providers/[id]?tenantId=... — SUPER ADMIN ONLY
// For global providers, tenantId is not required
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["super_admin"]);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  const provider = await db.aiProvider.findUnique({ where: { id } });
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!provider.isGlobal && provider.tenantId !== tenantId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await db.agent.updateMany({ where: { aiProviderId: id }, data: { aiProviderId: null } });
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

  const provider = await db.aiProvider.findUnique({ where: { id } });
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!provider.isGlobal && provider.tenantId !== tenantId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const data: any = {};
  for (const k of ["name", "type", "apiKey", "baseUrl", "model", "isActive", "isGlobal"]) {
    if (k in body) data[k] = body[k];
  }

  if (body.activate === true) {
    const targetTenantId = searchParams.get("tenantId");
    if (targetTenantId) {
      await db.agent.update({ where: { tenantId: targetTenantId }, data: { aiProviderId: id } });
    }
    return NextResponse.json({ ok: true, active: true });
  }
  if (body.deactivate === true) {
    const targetTenantId = searchParams.get("tenantId");
    if (targetTenantId) {
      await db.agent.updateMany({ where: { tenantId: targetTenantId, aiProviderId: id }, data: { aiProviderId: null } });
    }
    return NextResponse.json({ ok: true, active: false });
  }

  const updated = await db.aiProvider.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, type: updated.type, model: updated.model, isGlobal: updated.isGlobal });
}
