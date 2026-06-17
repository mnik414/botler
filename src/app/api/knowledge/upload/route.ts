import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildChunks } from "@/lib/ai-engine";

// POST /api/knowledge/upload  (multipart/form-data)
// fields: tenantId, file (File), title?, type?
// Parses PDF/DOCX/XLSX/CSV → extracts plain text → chunks → stores as a KnowledgeItem
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const tenantId = form.get("tenantId") as string;
    const file = form.get("file") as File | null;
    const title = (form.get("title") as string) || file?.name || "سند آپلود‌شده";
    if (!tenantId || !file) {
      return NextResponse.json({ error: "tenantId and file required" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    let type = "text";
    if (name.endsWith(".pdf")) type = "pdf";
    else if (name.endsWith(".docx")) type = "docx";
    else if (name.endsWith(".xlsx") || name.endsWith(".xls")) type = "excel";
    else if (name.endsWith(".csv")) type = "csv";
    else if (name.endsWith(".txt")) type = "text";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let content = "";

    if (type === "pdf") {
      // pdf-parse
      const pdfParse = (await import("pdf-parse")).default;
      const data = await pdfParse(buffer);
      content = data.text || "";
    } else if (type === "docx") {
      // mammoth
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      content = result.value || "";
    } else if (type === "excel") {
      // xlsx (sheetjs)
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws);
        sheets.push(`## ${name}\n${csv}`);
      }
      content = sheets.join("\n\n");
    } else if (type === "csv") {
      content = buffer.toString("utf-8");
    } else {
      content = buffer.toString("utf-8");
    }

    if (!content.trim()) {
      return NextResponse.json({ error: "محتوایی از فایل استخراج نشد" }, { status: 400 });
    }

    // Truncate to a reasonable size to avoid DB bloat (keep first 50k chars)
    const trimmed = content.slice(0, 50000);
    const chunks = buildChunks(trimmed);

    const item = await db.knowledgeItem.create({
      data: {
        tenantId,
        type,
        title,
        content: trimmed,
        chunksJson: JSON.stringify(chunks),
        status: "ready",
        size: buffer.length,
      },
    });

    return NextResponse.json({ ...item, chunks }, { status: 201 });
  } catch (e: any) {
    console.error("knowledge upload error", e);
    return NextResponse.json({ error: e.message || "خطا در پردازش فایل" }, { status: 500 });
  }
}
