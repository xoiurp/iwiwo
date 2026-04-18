import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// .env.local is loaded manually below so Prisma CLI picks up Neon creds
// (dotenv/config only reads .env by default).
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.POSTGRES_URL_NON_POOLING,
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
});
