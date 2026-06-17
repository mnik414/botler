import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const items = await db.knowledgeItem.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    items.map((i) => ({ ...i, chunks: JSON.parse(i.chunksJson || "[]") }))
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, type, title, content, question, url } = body;
  if (!tenantId || !title || !content) {
    return NextResponse.json({ error: "tenantId, title, content required" }, { status: 400 });
  }
  const { buildChunks } = await import("@/lib/ai-engine");
  const chunks = buildChunks(content, type === "faq" ? question : undefined);
  const item = await db.knowledgeItem.create({
    data: {
      tenantId,
      type: type || "text",
      title,
      content,
      question: question || "",
      url: url || "",
      chunksJson: JSON.stringify(chunks),
      status: "ready",
      size: content.length,
    },
  });
  return NextResponse.json({ ...item, chunks }, { status: 201 });
}
