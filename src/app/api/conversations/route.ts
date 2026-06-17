import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const convos = await db.conversation.findMany({
    where: { tenantId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 50 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(convos);
}

// Operator replies manually — requires tenantId to verify ownership (isolation)
export async function POST(req: Request) {
  const { conversationId, content, tenantId, operatorName = "اپراتور" } = await req.json();
  if (!tenantId || !conversationId || !content) {
    return NextResponse.json({ error: "tenantId, conversationId, content required" }, { status: 400 });
  }
  // Verify the conversation belongs to this tenant
  const convo = await db.conversation.findFirst({ where: { id: conversationId, tenantId } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const msg = await db.message.create({
    data: { conversationId, role: "operator", content },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: "ai", messageCount: { increment: 1 } },
  });
  return NextResponse.json(msg, { status: 201 });
}
