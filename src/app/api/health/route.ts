import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Lightweight liveness/readiness probe
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", time: new Date().toISOString() });
  } catch (e: any) {
    console.error("[health] db check failed", e);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
