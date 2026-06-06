import "dotenv/config";
import { defineConfig } from "prisma/config";

const localDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/indihub?schema=public";
const migrationDatabaseUrl =
  nonEmptyEnv("DATABASE_DIRECT_URL") ?? nonEmptyEnv("DATABASE_URL") ?? localDatabaseUrl;

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

function nonEmptyEnv(key: string) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}
