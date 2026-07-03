import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { testProvider, PROVIDER_TYPES, defaultBaseUrl } from "@/lib/llm-providers";

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
        // Skip if a provider with same name+type already exists for this tenant
        const existing = await db.aiProvider.findFirst({ where: { tenantId, name: String(name).trim(), type } });
        let providerId: string;
        if (existing) {
          // Update the existing one instead of duplicating
          const updated = await db.aiProvider.update({ where: { id: existing.id }, data: {
            apiKey: apiKey || existing.apiKey,
            baseUrl: baseUrl || existing.baseUrl,
            model: model || existing.model,
          }});
          providerId = updated.id;
        } else {
          const created = await db.aiProvider.create({
            data: {
              tenantId, name: String(name).trim(), type,
              apiKey: apiKey || "", baseUrl: baseUrl || defaultBaseUrl(type),
              model: model || pt.defaultModel, isActive: true,
              isGlobal: isGlobal || false,
            },
          });
          providerId = created.id;
        }
        // Optionally activate the new provider immediately
        if (activateAfterCreate) {
          await db.agent.update({ where: { tenantId }, data: { aiProviderId: providerId } });
        }
      } else if (action === "activate") {
        const { providerId, name, type } = body;
        let pid = providerId;
        if (!pid && name && type) {
          const p = await db.aiProvider.findFirst({ where: { tenantId, name, type } });
          pid = p?.id;
        }
        if (!pid) throw new Error("ارائه‌دهنده یافت نشد");
        await db.agent.update({ where: { tenantId }, data: { aiProviderId: pid } });
      } else if (action === "deactivate") {
        await db.agent.updateMany({ where: { tenantId }, data: { aiProviderId: null } });
      } else if (action === "delete") {
        const { providerId, name, type } = body;
        let pid = providerId;
        if (!pid && name && type) {
          const p = await db.aiProvider.findFirst({ where: { tenantId, name, type } });
          pid = p?.id;
        }
        if (pid) {
          await db.agent.updateMany({ where: { tenantId, aiProviderId: pid }, data: { aiProviderId: null } });
          await db.aiProvider.deleteMany({ where: { id: pid, tenantId } });
        }
      } else if (action === "test") {
        const { providerId, name, type } = body;
        let pid = providerId;
        if (!pid && name && type) {
          const p = await db.aiProvider.findFirst({ where: { tenantId, name, type } });
          pid = p?.id;
        }
        if (!pid) throw new Error("ارائه‌دهنده یافت نشد");
        const p = await db.aiProvider.findFirst({ where: { id: pid, tenantId } });
        if (!p) throw new Error("یافت نشد");
        console.log(`[Bulk Test] Testing provider: tenantId=${tenantId}, providerId=${p.id}, type=${p.type}, model=${p.model}`);
        const result = await testProvider({ id: p.id, type: p.type as any, apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model });
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
