import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const result = await seedDatabase(force);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST to seed the database" });
}
