import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireRole } from "@/lib/auth";

// PATCH /api/plans/[id] — update a plan (Super Admin only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ["super_admin"]);
  if (isResponse(auth)) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const numericFields = ["priceMonthly", "messageLimit", "conversationLimit", "voiceMinutes", "tokenLimit"];
  const data: any = {};
  if ("name" in body && typeof body.name === "string") data.name = body.name.slice(0, 200);
  if ("description" in body && typeof body.description === "string") data.description = body.description.slice(0, 2000);
  if ("popular" in body) data.popular = !!body.popular;
  for (const k of numericFields) {
    if (k in body) {
      const v = Number(body[k]);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ error: `مقدار ${k} نامعتبر است` }, { status: 400 });
      }
      data[k] = Math.round(v);
    }
  }
  if (Array.isArray(body.features)) {
    data.featuresJson = JSON.stringify(body.features.filter((f: unknown) => typeof f === "string").slice(0, 100));
  }

  const existing = await db.plan.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "پلن یافت نشد" }, { status: 404 });

  const plan = await db.plan.update({ where: { id }, data });
  let features: string[] = [];
  try {
    const parsed = JSON.parse(plan.featuresJson);
    if (Array.isArray(parsed)) features = parsed;
  } catch {}
  return NextResponse.json({ ...plan, features });
}
