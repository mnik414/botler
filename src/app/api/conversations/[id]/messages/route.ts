import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET messages of a conversation — requires ?tenantId= and verifies ownership (isolation)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  // Verify the conversation belongs to this tenant
  const convo = await db.conversation.findFirst({ where: { id, tenantId } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    messages.map((m) => ({ ...m, sources: JSON.parse(m.sourcesJson || "[]") }))
  );
}
