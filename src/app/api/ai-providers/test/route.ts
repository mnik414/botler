import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { testProvider, PROVIDER_TYPES, defaultBaseUrl, type AiProviderConfig } from "@/lib/llm-providers";

// POST /api/ai-providers/test
// Two modes:
//   1. With tenantId + providerId → test an existing saved provider from DB
//   2. With type + apiKey + baseUrl + model → test ad-hoc (e.g. from create dialog)
export async function POST(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (auth instanceof Response) return auth;

  const body = await req.json();
  const LOG_PREFIX = "[AI-Providers Test API]";
  console.log(`${LOG_PREFIX} Request received`, {
    hasTenantId: !!body.tenantId,
    hasProviderId: !!body.providerId,
    hasInlineConfig: !!(body.type && body.apiKey),
  });

  let config: AiProviderConfig;

  // Mode 1: Existing provider from DB
  if (body.tenantId && body.providerId) {
    console.log(`${LOG_PREFIX} Looking up existing provider: tenantId=${body.tenantId}, providerId=${body.providerId}`);
    const provider = await db.aiProvider.findFirst({
      where: { id: body.providerId, tenantId: body.tenantId },
    });
    if (!provider) {
      console.log(`${LOG_PREFIX} Provider not found in DB`);
      return NextResponse.json({ ok: false, error: "ارائه‌دهنده یافت نشد" }, { status: 404 });
    }
    config = {
      id: provider.id,
      type: provider.type as AiProviderConfig["type"],
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
    };
    console.log(`${LOG_PREFIX} Found provider`, {
      id: config.id,
      type: config.type,
      model: config.model,
      baseUrl: config.baseUrl || "(default)",
      apiKeyPrefix: config.apiKey ? config.apiKey.slice(0, 8) + "..." : "(empty)",
    });
  }
  // Mode 2: Inline / ad-hoc config (from create dialog)
  else if (body.type && body.apiKey) {
    const pt = PROVIDER_TYPES.find((p) => p.code === body.type);
    if (!pt) {
      return NextResponse.json({ ok: false, error: "نوع ارائه‌دهنده نامعتبر است" }, { status: 400 });
    }
    config = {
      id: "test",
      type: body.type as AiProviderConfig["type"],
      apiKey: body.apiKey,
      baseUrl: body.baseUrl || defaultBaseUrl(body.type),
      model: body.model || pt.defaultModel,
    };
    console.log(`${LOG_PREFIX} Testing inline config`, {
      type: config.type,
      model: config.model,
      baseUrl: config.baseUrl || "(default)",
      apiKeyPrefix: config.apiKey ? config.apiKey.slice(0, 8) + "..." : "(empty)",
    });
  } else {
    console.log(`${LOG_PREFIX} Invalid request: missing required fields`);
    return NextResponse.json({
      ok: false,
      error: "لطفاً یا tenantId+providerId یا type+apiKey را ارسال کنید",
    }, { status: 400 });
  }

  // Run the test
  console.log(`${LOG_PREFIX} Calling testProvider...`);
  const result = await testProvider(config);
  console.log(`${LOG_PREFIX} Test result:`, {
    ok: result.ok,
    reply: result.reply ? result.reply.slice(0, 100) : "(empty)",
    error: result.error || "(none)",
  });

  // If this was an existing provider, update lastTestedAt / lastTestOk in DB
  if (body.tenantId && body.providerId) {
    await db.aiProvider.update({
      where: { id: body.providerId },
      data: { lastTestedAt: new Date(), lastTestOk: result.ok },
    });
    console.log(`${LOG_PREFIX} Updated provider test status in DB`);
  }

  return NextResponse.json(result);
}