// Next.js instrumentation hook — runs once per server process before serving
// requests. Used for environment validation and SQLite pragma initialization.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  if (process.env.DATABASE_URL?.startsWith("file:")) {
    const { initSqlite } = await import("@/lib/db");
    await initSqlite();
  }
}
