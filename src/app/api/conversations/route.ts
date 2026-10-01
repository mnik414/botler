import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenant } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await requireTenant(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const { limit, offset } = parsePagination(searchParams, { limit: 100, max: 200 });
  const convos = await db.conversation.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      // Preview only — full history comes from the messages endpoint.
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });
  return NextResponse.json(convos);
}

// Operator replies manually
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const auth = await requireTenant(req, body.tenantId);
  if (isResponse(auth)) return auth;

  const { conversationId, content } = body;
  if (typeof conversationId !== "string" || typeof content !== "string" || !conversationId || !content.trim()) {
    return NextResponse.json({ error: "conversationId و متن پیام الزامی است" }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "متن پیام بیش از حد طولانی است" }, { status: 400 });
  }

  const convo = await db.conversation.findFirst({
    where: { id: conversationId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msg = await db.message.create({
    data: { conversationId, role: "operator", content },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: "ai", operatorId: auth.user.id, messageCount: { increment: 1 } },
  });
  return NextResponse.json(msg, { status: 201 });
}
