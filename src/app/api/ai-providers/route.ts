import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PROVIDER_TYPES, defaultBaseUrl } from "@/lib/llm-providers";

// GET /api/ai-providers?tenantId=... — list a tenant's configured AI providers + global providers
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const providers = await db.aiProvider.findMany({
    where: { OR: [{ tenantId }, { isGlobal: true }] },
    orderBy: [{ isGlobal: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, tenantId: true, name: true, type: true, baseUrl: true,
      model: true, isActive: true, isGlobal: true, lastTestedAt: true, lastTestOk: true,
      createdAt: true, updatedAt: true,
    },
  });
  const agent = await db.agent.findUnique({ where: { tenantId }, select: { aiProviderId: true } });
  return NextResponse.json({ providers, activeProviderId: agent?.aiProviderId || null, providerTypes: PROVIDER_TYPES });
}

// POST /api/ai-providers — create a new provider config (SUPER ADMIN ONLY)
export async function POST(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (auth instanceof Response) return auth;

  const body = await req.json();
  const { tenantId, name, type, apiKey, baseUrl, model, isGlobal } = body;
  if (!name || !type) {
    return NextResponse.json({ error: "name, type required" }, { status: 400 });
  }
  if (!isGlobal && !tenantId) {
    return NextResponse.json({ error: "tenantId required for non-global providers" }, { status: 400 });
  }
  const pt = PROVIDER_TYPES.find((p) => p.code === type);
  if (!pt) return NextResponse.json({ error: "نوع ارائه‌دهنده نامعتبر است" }, { status: 400 });
  if (pt.needsKey && !apiKey) {
    return NextResponse.json({ error: "کلید API الزامی است برای این نوع ارائه‌دهنده" }, { status: 400 });
  }
  if (pt.needsBaseUrl && !baseUrl) {
    return NextResponse.json({ error: "آدرس Base URL الزامی است برای ارائه‌دهنده سفارشی" }, { status: 400 });
  }

  const provider = await db.aiProvider.create({
    data: {
      tenantId: isGlobal ? null : tenantId,
      name: name.trim(),
      type,
      apiKey: apiKey || "",
      baseUrl: baseUrl || defaultBaseUrl(type),
      model: model || pt.defaultModel,
      isActive: true,
      isGlobal: isGlobal || false,
    },
  });
  return NextResponse.json({ id: provider.id, name: provider.name, type: provider.type, model: provider.model, isGlobal: provider.isGlobal }, { status: 201 });
}
