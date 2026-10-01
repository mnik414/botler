import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";
import { PROVIDER_TYPES, validateBaseUrl } from "@/lib/llm-providers";
import { encryptSecret } from "@/lib/crypto";

// DELETE /api/ai-providers/[id]?tenantId=... — SUPER ADMIN ONLY
// For global providers, tenantId is not required
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

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
  if (isResponse(auth)) return auth;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  const provider = await db.aiProvider.findUnique({ where: { id } });
  if (!provider) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!provider.isGlobal && provider.tenantId !== tenantId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.name === "string") data.name = body.name.slice(0, 200);
  if (typeof body.apiKey === "string" && body.apiKey) data.apiKey = encryptSecret(body.apiKey);
  if (typeof body.model === "string") data.model = body.model.slice(0, 200);
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.isGlobal === "boolean") data.isGlobal = body.isGlobal;
  if (typeof body.type === "string") {
    if (!PROVIDER_TYPES.some((p) => p.code === body.type)) {
      return NextResponse.json({ error: "نوع ارائه‌دهنده نامعتبر است" }, { status: 400 });
    }
    data.type = body.type;
  }
  if (typeof body.baseUrl === "string" && body.baseUrl) {
    const check = validateBaseUrl(body.baseUrl);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    data.baseUrl = check.url;
  }

  if (body.activate === true) {
    const targetTenantId = searchParams.get("tenantId");
    if (targetTenantId) {
      await db.agent.updateMany({ where: { tenantId: targetTenantId }, data: { aiProviderId: id } });
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
