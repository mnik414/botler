import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Readiness probe: verifies the DB is reachable AND migrations were applied.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    const migrations = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    const applied = Number(migrations?.[0]?.count || 0);
    if (applied === 0) {
      return NextResponse.json({ ok: false, db: "up", migrations: 0 }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      db: "up",
      migrations: applied,
      time: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[health] db check failed", e);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
