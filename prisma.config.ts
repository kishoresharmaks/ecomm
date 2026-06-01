import "dotenv/config";
import { defineConfig } from "prisma/config";

const localDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/indihub?schema=public";
const migrationDatabaseUrl =
  process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL ?? localDatabaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: migrationDatabaseUrl
  }
});
