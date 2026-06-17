import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = await db.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(
    messages.map((m) => ({ ...m, sources: JSON.parse(m.sourcesJson || "[]") }))
  );
}
