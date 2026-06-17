import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";

export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const agent = await db.agent.findUnique({ where: { tenantId } });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ...agent,
    channels: JSON.parse(agent.channelsJson),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const body = await req.json();
  const allowed = ["name", "systemPrompt", "model", "temperature", "confidenceThreshold", "greetingMessage", "voiceEnabled", "humanHandoff", "growthLoop"];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];
  if (body.channels) data.channelsJson = JSON.stringify(body.channels);

  let agent = await db.agent.findUnique({ where: { tenantId } });
  if (!agent) {
    const bt = getBusinessType(body.businessType || "other");
    agent = await db.agent.create({
      data: { tenantId, systemPrompt: bt.prompt, ...data },
    });
  } else {
    agent = await db.agent.update({ where: { tenantId }, data });
  }
  return NextResponse.json({ ...agent, channels: JSON.parse(agent.channelsJson) });
}
