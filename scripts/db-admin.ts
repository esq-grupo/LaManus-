// Ligação de ADMINISTRAÇÃO (dono das tabelas): só para migrações, seed, pré-verificação e limpeza de testes.
// O código da aplicação (src/) NUNCA usa isto — corre com o papel restrito `lamanus_app` (DATABASE_URL).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

export const urlAdmin = (): string => {
  const url = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("ADMIN_DATABASE_URL (ou DATABASE_URL) não definida (ver .env.example)");
  return url;
};

export function criarClienteAdmin(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: urlAdmin() }) });
}
