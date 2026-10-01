import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Keep every SQLite connection serialized through a single connection so the
// WAL/busy_timeout pragmas below apply to all queries and concurrent writes
// queue instead of failing with SQLITE_BUSY. No-op for non-file URLs.
function withSqliteConnectionLimit(url: string | undefined): string | undefined {
  if (!url || !url.startsWith('file:')) return url
  if (url.includes('connection_limit=')) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connection_limit=1`
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withSqliteConnectionLimit(process.env.DATABASE_URL),
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

let sqliteReady: Promise<void> | null = null

// Applies WAL + busy timeout to the (single) SQLite connection. Awaited from
// instrumentation.ts before the server starts handling requests.
export function initSqlite(): Promise<void> {
  if (!process.env.DATABASE_URL?.startsWith('file:')) return Promise.resolve()
  if (!sqliteReady) {
    sqliteReady = (async () => {
      try {
        // PRAGMA statements return rows; $queryRawUnsafe is required here.
        await db.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
        await db.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
        await db.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
      } catch (e) {
        console.error('[db] failed to apply SQLite pragmas', e)
      }
    })()
  }
  return sqliteReady
}
