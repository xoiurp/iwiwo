import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 removed the built-in query engine in favour of driver adapters.
// We must pass `adapter: new PrismaPg({...})` to the PrismaClient constructor.
// Ref: https://pris.ly/d/client-constructor
//
// At runtime on Vercel we prefer the pooled URL (pgBouncer-style) because
// serverless functions are short-lived and would otherwise exhaust Neon
// connections. Fall back to the direct URL for local dev / scripts.
const connectionString =
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'No Postgres connection string found. Set POSTGRES_URL (or POSTGRES_URL_NON_POOLING) in your environment.'
  );
}

function makeClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log: ['error', 'warn'] });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
