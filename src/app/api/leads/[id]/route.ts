import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenant } from "@/lib/auth";
import { normalizePhone } from "@/lib/ai-engine";

const ALLOWED_STATUS = ["new", "contacted", "converted", "lost"];
const ALLOWED_INTENTS = ["inquiry", "order", "booking", "appointment", "callback"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const auth = await requireTenant(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const lead = await db.lead.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const data: any = {};
  if ("status" in body) {
    if (typeof body.status !== "string" || !ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }
    data.status = body.status;
  }
  if ("intent" in body) {
    if (typeof body.intent !== "string" || !ALLOWED_INTENTS.includes(body.intent)) {
      return NextResponse.json({ error: "نوع درخواست نامعتبر است" }, { status: 400 });
    }
    data.intent = body.intent;
  }
  if ("name" in body && typeof body.name === "string") data.name = body.name.slice(0, 200);
  if ("phone" in body && typeof body.phone === "string") {
    const canonical = normalizePhone(body.phone);
    if (!canonical) return NextResponse.json({ error: "شماره تماس معتبر نیست" }, { status: 400 });
    data.phone = canonical;
  }
  if ("email" in body && typeof body.email === "string") data.email = body.email.slice(0, 200);
  if ("value" in body && typeof body.value === "number" && Number.isFinite(body.value) && body.value >= 0) {
    data.value = Math.round(body.value);
  }

  try {
    const updated = await db.lead.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "لید دیگری با این شماره تماس وجود دارد" }, { status: 409 });
    }
    throw e;
  }
}
