import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenant } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const auth = await requireTenant(req, searchParams.get("tenantId"));
  if (isResponse(auth)) return auth;

  const convo = await db.conversation.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json(
    messages.map((m) => {
      let sources: any[] = [];
      try {
        const parsed = JSON.parse(m.sourcesJson || "[]");
        if (Array.isArray(parsed)) sources = parsed;
      } catch {
        sources = [];
      }
      return { ...m, sources };
    })
  );
}
