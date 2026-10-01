import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildChunks } from "@/lib/ai-engine";
import { isResponse, requireTenantOwner } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONTENT_LENGTH = 200_000;

type ExtractResult = { content: string; type: string };

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractSpreadsheet(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames.slice(0, 20)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    parts.push(`# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`);
  }
  return parts.join("\n\n");
}

async function extractFile(file: File): Promise<ExtractResult | { error: string }> {
  const name = (file.name || "file").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (name.endsWith(".pdf")) {
      return { content: await extractPdf(buffer), type: "pdf" };
    }
    if (name.endsWith(".docx")) {
      return { content: await extractDocx(buffer), type: "docx" };
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      return { content: await extractSpreadsheet(buffer), type: "excel" };
    }
    if (name.endsWith(".csv")) {
      return { content: buffer.toString("utf8"), type: "csv" };
    }
    if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".json")) {
      return { content: buffer.toString("utf8"), type: "text" };
    }
    return { error: "فرمت فایل پشتیبانی نمی‌شود. فرمت‌های مجاز: pdf, docx, xlsx, csv, txt" };
  } catch (e: any) {
    console.error("[knowledge/upload] extraction failed", e);
    return { error: "خواندن فایل ممکن نشد. مطمئن شوید فایل سالم است." };
  }
}

export async function POST(req: Request) {
  const limit = rateLimit(`upload:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "فرم آپلود نامعتبر است" }, { status: 400 });
  }

  const tenantId = formData.get("tenantId");
  const auth = await requireTenantOwner(req, typeof tenantId === "string" ? tenantId : null);
  if (isResponse(auth)) return auth;

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی انتخاب نشده است" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "فایل خالی است" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "حداکثر حجم فایل ۱۰ مگابایت است" }, { status: 400 });
  }

  const extracted = await extractFile(file);
  if ("error" in extracted) {
    return NextResponse.json({ error: extracted.error }, { status: 400 });
  }

  const content = extracted.content.replace(/\u0000/g, "").trim().slice(0, MAX_CONTENT_LENGTH);
  if (content.length < 5) {
    return NextResponse.json({ error: "متنی از فایل استخراج نشد" }, { status: 400 });
  }

  const titleRaw = formData.get("title");
  const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim().slice(0, 300) : file.name.slice(0, 300);
  const chunks = buildChunks(content);

  const item = await db.knowledgeItem.create({
    data: {
      tenantId: auth.tenantId,
      type: extracted.type,
      title,
      content,
      question: "",
      url: "",
      chunksJson: JSON.stringify(chunks),
      status: "ready",
      size: content.length,
    },
  });

  return NextResponse.json({ ...item, chunks }, { status: 201 });
}
