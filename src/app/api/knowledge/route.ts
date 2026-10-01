import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isResponse, requireTenant, requireTenantOwner } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { parsePagination } from "@/lib/pagination";

const ALLOWED_TYPES = ["faq", "text", "website", "csv", "pdf", "docx", "excel"];

function safeChunks(json: string): any[] {
  try {
    const parsed = JSON.parse(json || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requestedTenant = searchParams.get("tenantId");
  const wantsPublic = searchParams.get("public") === "1";

  const auth = await requireTenant(req, requestedTenant);
  if (isResponse(auth)) {
    // Public FAQ projection used by the business profile page.
    if (wantsPublic && requestedTenant) {
      const limit = rateLimit(`knowledge-public:${clientIp(req)}`, 60, 60_000);
      if (!limit.ok) return tooManyRequests(limit.retryAfterSec);
      const faqs = await db.knowledgeItem.findMany({
        where: { tenantId: requestedTenant, type: "faq", status: "ready" },
        select: { id: true, title: true, question: true, content: true, type: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json(faqs);
    }
    return auth;
  }

  const { limit, offset } = parsePagination(searchParams, { limit: 500, max: 1000 });
  const items = await db.knowledgeItem.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  return NextResponse.json(items.map((i) => ({ ...i, chunks: safeChunks(i.chunksJson) })));
}

export async function POST(req: Request) {
  const limit = rateLimit(`knowledge-write:${clientIp(req)}`, 60, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const auth = await requireTenantOwner(req, body.tenantId);
  if (isResponse(auth)) return auth;

  const { type, title, content, question, url } = body;
  if (typeof title !== "string" || typeof content !== "string" || !title.trim() || !content.trim()) {
    return NextResponse.json({ error: "عنوان و محتوا الزامی است" }, { status: 400 });
  }
  if (content.length > 200_000) {
    return NextResponse.json({ error: "محتوا بیش از حد طولانی است (حداکثر ۲۰۰ هزار کاراکتر)" }, { status: 400 });
  }
  const safeType = typeof type === "string" && ALLOWED_TYPES.includes(type) ? type : "text";
  const { buildChunks } = await import("@/lib/ai-engine");
  const chunks = buildChunks(content, safeType === "faq" && typeof question === "string" ? question : undefined);
  const item = await db.knowledgeItem.create({
    data: {
      tenantId: auth.tenantId,
      type: safeType,
      title: String(title).slice(0, 300),
      content,
      question: typeof question === "string" ? question.slice(0, 1000) : "",
      url: typeof url === "string" ? url.slice(0, 2000) : "",
      chunksJson: JSON.stringify(chunks),
      status: "ready",
      size: content.length,
    },
  });
  return NextResponse.json({ ...item, chunks }, { status: 201 });
}
