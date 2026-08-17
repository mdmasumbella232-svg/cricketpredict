// Prisma client configured for both local SQLite (dev) and Turso/libSQL (production).
//
// - In development: uses the default SQLite provider (file:./db/custom.db)
// - In production (Vercel): uses the @prisma/adapter-libsql driver adapter
//   to connect to Turso's libSQL database via DATABASE_URL.
//
// The adapter is auto-detected based on whether DATABASE_URL starts with
// "libsql://" or "https://" (Turso connection strings).

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient, type Client } from '@libsql/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || '';
  const isTurso = databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://');

  if (isTurso) {
    // Production: connect to Turso via libSQL adapter
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
    const libsqlClient: Client = createClient({
      url: databaseUrl,
      authToken,
    });
    const adapter = new PrismaLibSql(libsqlClient);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });
  }

  // Development: use local SQLite
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
