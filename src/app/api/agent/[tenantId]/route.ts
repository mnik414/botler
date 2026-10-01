import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBusinessType } from "@/lib/business-types";
import { getAuthUser, isResponse, requireTenantOwner } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

function safeChannels(json: string): string[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  const user = await getAuthUser(req);
  const isMember = !!user && (user.role === "super_admin" || user.tenantId === tenantId);

  if (isMember) {
    const agent = await db.agent.findUnique({ where: { tenantId } });
    if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ...agent, channels: safeChannels(agent.channelsJson) });
  }

  // Public projection for the embeddable widget — greeting only, no prompt/config
  const limit = rateLimit(`agent-public:${clientIp(req)}`, 120, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const agent = await db.agent.findUnique({
    where: { tenantId },
    select: { name: true, greetingMessage: true, voiceEnabled: true },
  });
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const auth = await requireTenantOwner(req, tenantId);
  if (isResponse(auth)) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const allowed = ["name", "systemPrompt", "model", "temperature", "confidenceThreshold", "greetingMessage", "voiceEnabled", "humanHandoff", "growthLoop"];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];

  if (typeof data.name === "string" && data.name.length > 120) data.name = data.name.slice(0, 120);
  if (typeof data.systemPrompt === "string" && data.systemPrompt.length > 20000) data.systemPrompt = data.systemPrompt.slice(0, 20000);
  if (typeof data.greetingMessage === "string" && data.greetingMessage.length > 2000) data.greetingMessage = data.greetingMessage.slice(0, 2000);
  if (data.temperature !== undefined && (typeof data.temperature !== "number" || data.temperature < 0 || data.temperature > 2)) delete data.temperature;
  if (data.confidenceThreshold !== undefined && (typeof data.confidenceThreshold !== "number" || data.confidenceThreshold < 0 || data.confidenceThreshold > 1)) delete data.confidenceThreshold;

  if (body.channels) {
    if (!Array.isArray(body.channels)) return NextResponse.json({ error: "channels باید آرایه باشد" }, { status: 400 });
    const allowedChannels = ["website", "widget", "instagram", "whatsapp", "telegram", "bale", "voice"];
    data.channelsJson = JSON.stringify(body.channels.filter((c: unknown) => typeof c === "string" && allowedChannels.includes(c)));
  }

  let agent = await db.agent.findUnique({ where: { tenantId: auth.tenantId } });
  if (!agent) {
    const bt = getBusinessType(typeof body.businessType === "string" ? body.businessType : "other");
    agent = await db.agent.create({
      data: { tenantId: auth.tenantId, systemPrompt: bt.prompt, ...data },
    });
  } else {
    agent = await db.agent.update({ where: { tenantId: auth.tenantId }, data });
  }
  return NextResponse.json({ ...agent, channels: safeChannels(agent.channelsJson) });
}
