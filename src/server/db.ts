import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida (ver .env.example)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

function obter(): PrismaClient {
  globalForPrisma.prisma ??= criarCliente();
  return globalForPrisma.prisma;
}

/** Cliente preguiçoso: só liga à BD no primeiro uso (permite importar módulos sem BD, p.ex. em testes unitários). */
export const db = new Proxy({} as PrismaClient, {
  get: (_alvo, propriedade) => Reflect.get(obter(), propriedade),
});
