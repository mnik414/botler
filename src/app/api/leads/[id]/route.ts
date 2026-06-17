import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["status", "intent", "name", "phone", "email", "value"];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  const lead = await db.lead.update({ where: { id }, data });
  return NextResponse.json(lead);
}
