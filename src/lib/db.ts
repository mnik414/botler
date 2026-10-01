import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// SQLite: enable WAL + a busy timeout to reduce "database is locked" errors
// under concurrent webhook/chat writes. No-op for other providers.
if (process.env.DATABASE_URL?.startsWith('file:')) {
  Promise.allSettled([
    db.$queryRawUnsafe('PRAGMA journal_mode=WAL;'),
    db.$queryRawUnsafe('PRAGMA busy_timeout=5000;'),
    db.$queryRawUnsafe('PRAGMA synchronous=NORMAL;'),
  ]).catch(() => {})
}