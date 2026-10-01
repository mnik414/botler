import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";
import { testProvider, PROVIDER_TYPES, defaultBaseUrl, validateBaseUrl, type AiProviderConfig } from "@/lib/llm-providers";
import { decryptSecret } from "@/lib/crypto";

// POST /api/ai-providers/test (super admin only)
// Two modes:
//   1. With tenantId + providerId → test an existing saved provider from DB
//      (for global providers, providerId alone is sufficient)
//   2. With type + apiKey + baseUrl + model → test ad-hoc (e.g. from create dialog)
export async function POST(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  let config: AiProviderConfig;
  let savedProviderId: string | null = null;

  // Mode 1: existing provider from DB
  if (body.providerId && typeof body.providerId === "string") {
    const provider = await db.aiProvider.findFirst({
      where: {
        id: body.providerId,
        ...(body.tenantId ? { OR: [{ tenantId: body.tenantId }, { isGlobal: true }] } : {}),
      },
    });
    if (!provider) {
      return NextResponse.json({ ok: false, error: "ارائه‌دهنده یافت نشد" }, { status: 404 });
    }
    config = {
      id: provider.id,
      type: provider.type as AiProviderConfig["type"],
      apiKey: decryptSecret(provider.apiKey),
      baseUrl: provider.baseUrl,
      model: provider.model,
    };
    savedProviderId = provider.id;
  }
  // Mode 2: inline / ad-hoc config (from create dialog)
  else if (typeof body.type === "string" && typeof body.apiKey === "string") {
    const pt = PROVIDER_TYPES.find((p) => p.code === body.type);
    if (!pt) {
      return NextResponse.json({ ok: false, error: "نوع ارائه‌دهنده نامعتبر است" }, { status: 400 });
    }
    const baseUrl = body.baseUrl || defaultBaseUrl(body.type);
    const check = validateBaseUrl(baseUrl);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 400 });
    config = {
      id: "test",
      type: body.type as AiProviderConfig["type"],
      apiKey: body.apiKey,
      baseUrl: check.url,
      model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : pt.defaultModel,
    };
  } else {
    return NextResponse.json(
      { ok: false, error: "لطفاً یا providerId یا type+apiKey را ارسال کنید" },
      { status: 400 }
    );
  }

  const result = await testProvider(config);

  if (savedProviderId) {
    await db.aiProvider.update({
      where: { id: savedProviderId },
      data: { lastTestedAt: new Date(), lastTestOk: result.ok },
    });
  }

  return NextResponse.json(result);
}
