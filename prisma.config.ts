import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  // Postgres connection comes from DATABASE_URL at runtime.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
