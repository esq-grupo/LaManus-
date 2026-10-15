import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrações correm como DONO (ADMIN_DATABASE_URL); a aplicação corre com o papel restrito (DATABASE_URL).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL ?? "" },
});
