import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { testProvider, PROVIDER_TYPES, defaultBaseUrl, validateBaseUrl } from "@/lib/llm-providers";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

function validatedBaseUrl(baseUrl: unknown, type: string): string {
  if (typeof baseUrl === "string" && baseUrl.trim()) {
    const check = validateBaseUrl(baseUrl.trim());
    if (!check.ok) throw new Error(check.error);
    return check.url;
  }
  return defaultBaseUrl(type as any);
}

// Bulk operations across multiple tenants — SUPER ADMIN ONLY
//
// POST /api/ai-providers/bulk
// body: {
//   action: "create" | "activate" | "deactivate" | "delete" | "test",
//   tenantIds: string[],        // one or more tenant ids
//   // for "create": name, type, apiKey, baseUrl, model
//   // for "activate"/"deactivate"/"delete"/"test": providerId OR (name+type) to find it
// }
export async function POST(req: Request) {
  const auth = await requireRole(req, ["super_admin"]);
  if (auth instanceof Response) return auth;

  const body = await req.json();
  const { action, tenantIds } = body as { action: string; tenantIds: string[] };

  if (!action || !Array.isArray(tenantIds) || tenantIds.length === 0) {
    return NextResponse.json({ error: "action و tenantIds (آرایه غیرخالی) الزامی است" }, { status: 400 });
  }

  const results: { tenantId: string; ok: boolean; error?: string }[] = [];

  for (const tenantId of tenantIds) {
    try {
      if (action === "create") {
        const { name, type, apiKey, baseUrl, model, activateAfterCreate, isGlobal } = body;
        if (!name || !type) throw new Error("name و type الزامی است");
        const pt = PROVIDER_TYPES.find((p) => p.code === type);
        if (!pt) throw new Error("نوع نامعتبر");
        if (pt.needsKey && !apiKey) throw new Error("کلید API الزامی است");
        if (pt.needsBaseUrl && !baseUrl) throw new Error("Base URL الزامی است");
        const normalizedBaseUrl = validatedBaseUrl(baseUrl, type);
        const global = isGlobal === true;
        // Global providers are single rows (tenantId = null) shared by everyone.
        const existing = await db.aiProvider.findFirst({
          where: global ? { isGlobal: true, name: String(name).trim(), type } : { tenantId, name: String(name).trim(), type },
        });
        let providerId: string;
        if (existing) {
          const updated = await db.aiProvider.update({ where: { id: existing.id }, data: {
            apiKey: apiKey ? encryptSecret(apiKey) : existing.apiKey,
            baseUrl: normalizedBaseUrl,
            model: model || existing.model,
          }});
          providerId = updated.id;
        } else {
          const created = await db.aiProvider.create({
            data: {
              tenantId: global ? null : tenantId,
              name: String(name).trim(),
              type,
              apiKey: encryptSecret(apiKey || ""),
              baseUrl: normalizedBaseUrl,
              model: model || pt.defaultModel,
              isActive: true,
              isGlobal: global,
            },
          });
          providerId = created.id;
        }
        if (activateAfterCreate) {
          await db.agent.update({ where: { tenantId }, data: { aiProviderId: providerId } });
        }
      } else if (action === "activate") {
        const { providerId, name, type } = body;
        let pid = providerId;
        if (!pid && name && type) {
          const p = await db.aiProvider.findFirst({ where: { OR: [{ tenantId }, { isGlobal: true }], name, type, isActive: true } });
          pid = p?.id;
        }
        if (!pid) throw new Error("ارائه‌دهنده یافت نشد");
        const scoped = await db.aiProvider.findFirst({ where: { id: pid, OR: [{ tenantId }, { isGlobal: true }] }, select: { id: true, isActive: true } });
        if (!scoped) throw new Error("ارائه‌دهنده یافت نشد");
        if (!scoped.isActive) throw new Error("ارائه‌دهنده غیرفعال است");
        await db.agent.update({ where: { tenantId }, data: { aiProviderId: scoped.id } });
      } else if (action === "deactivate") {
        await db.agent.updateMany({ where: { tenantId }, data: { aiProviderId: null } });
      } else if (action === "delete") {
        const { providerId, name, type } = body;
        let pid = providerId;
        if (!pid && name && type) {
          const p = await db.aiProvider.findFirst({ where: { OR: [{ tenantId }, { isGlobal: true }], name, type } });
          pid = p?.id;
        }
        if (pid) {
          const scoped = await db.aiProvider.findFirst({ where: { id: pid, OR: [{ tenantId }, { isGlobal: true }] }, select: { id: true } });
          if (!scoped) throw new Error("ارائه‌دهنده یافت نشد");
          await db.agent.updateMany({ where: { tenantId, aiProviderId: scoped.id }, data: { aiProviderId: null } });
          await db.aiProvider.delete({ where: { id: scoped.id } });
        }
      } else if (action === "test") {
        const { providerId, name, type } = body;
        let pid = providerId;
        if (!pid && name && type) {
          const p = await db.aiProvider.findFirst({ where: { OR: [{ tenantId }, { isGlobal: true }], name, type } });
          pid = p?.id;
        }
        if (!pid) throw new Error("ارائه‌دهنده یافت نشد");
        const p = await db.aiProvider.findFirst({ where: { id: pid, OR: [{ tenantId }, { isGlobal: true }] } });
        if (!p) throw new Error("یافت نشد");
        console.log(`[Bulk Test] Testing provider: tenantId=${tenantId}, providerId=${p.id}, type=${p.type}, model=${p.model}`);
        const result = await testProvider({ id: p.id, type: p.type as any, apiKey: decryptSecret(p.apiKey), baseUrl: p.baseUrl, model: p.model });
        console.log(`[Bulk Test] Result: ok=${result.ok}, reply=${result.reply?.slice(0, 50) || "(empty)"}, error=${result.error || "(none)"}`);
        await db.aiProvider.update({ where: { id: p.id }, data: { lastTestedAt: new Date(), lastTestOk: result.ok } });
        if (!result.ok) throw new Error(result.error || "تست ناموفق");
      } else {
        throw new Error("action نامعتبر");
      }
      results.push({ tenantId, ok: true });
    } catch (e: any) {
      results.push({ tenantId, ok: false, error: e.message || String(e) });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.length - successCount;
  return NextResponse.json({ results, successCount, failCount, total: results.length });
}
