import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const leads = await db.lead.findMany({
    where: { tenantId },
    include: { conversation: { select: { id: true, channel: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, conversationId, name, phone, email, source, intent, notes } = body;
  if (!tenantId || !phone) return NextResponse.json({ error: "tenantId, phone required" }, { status: 400 });
  const lead = await db.lead.create({
    data: {
      tenantId,
      conversationId: conversationId || null,
      name: name || "مهمان",
      phone,
      email: email || "",
      source: source || "manual",
      intent: intent || "inquiry",
      status: "new",
      notesJson: JSON.stringify(notes || []),
    },
  });
  return NextResponse.json(lead, { status: 201 });
}
