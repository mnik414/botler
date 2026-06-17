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

// Operator replies manually
export async function POST(req: Request) {
  const { conversationId, content, operatorName = "اپراتور" } = await req.json();
  const msg = await db.message.create({
    data: { conversationId, role: "operator", content },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: "ai", messageCount: { increment: 1 } },
  });
  return NextResponse.json(msg, { status: 201 });
}
