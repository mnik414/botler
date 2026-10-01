import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenant } from "@/lib/auth";
import { normalizePhone } from "@/lib/ai-engine";
import { parsePagination } from "@/lib/pagination";

const ALLOWED_INTENTS = ["inquiry", "order", "booking", "appointment", "callback"];
const ALLOWED_SOURCES = ["chat", "voice", "form", "referral", "manual", "widget"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await requireTenant(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const { limit, offset } = parsePagination(searchParams, { limit: 500, max: 1000 });
  const leads = await db.lead.findMany({
    where: { tenantId: auth.tenantId },
    include: { conversation: { select: { id: true, channel: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  return NextResponse.json(leads);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const auth = await requireTenant(req, body.tenantId);
  if (isResponse(auth)) return auth;

  const { conversationId, name, phone, email, source, intent, notes } = body;
  if (typeof phone !== "string" || !normalizePhone(phone)) {
    return NextResponse.json({ error: "شماره تماس الزامی است" }, { status: 400 });
  }
  const normalizedPhone = normalizePhone(phone);

  if (conversationId) {
    const convo = await db.conversation.findFirst({
      where: { id: String(conversationId), tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!convo) return NextResponse.json({ error: "مکالمه یافت نشد" }, { status: 404 });
  }

  try {
    const lead = await db.lead.create({
      data: {
        tenantId: auth.tenantId,
        conversationId: conversationId ? String(conversationId) : null,
        name: typeof name === "string" && name.trim() ? name.slice(0, 200) : "مهمان",
        phone: normalizedPhone,
        email: typeof email === "string" ? email.slice(0, 200) : "",
        source: typeof source === "string" && ALLOWED_SOURCES.includes(source) ? source : "manual",
        intent: typeof intent === "string" && ALLOWED_INTENTS.includes(intent) ? intent : "inquiry",
        status: "new",
        notesJson: JSON.stringify(Array.isArray(notes) ? notes.slice(0, 50) : []),
      },
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "لیدی با این شماره تماس قبلاً ثبت شده است" }, { status: 409 });
    }
    throw e;
  }
}
