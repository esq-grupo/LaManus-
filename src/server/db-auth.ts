import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Ligação do MÓDULO DE AUTENTICAÇÃO (papel `lamanus_auth`, ADR-0008). Só o código em `src/server/auth/*` a deve importar:
// é a única que escreve sessões, tentativas de login e recuperações de palavra-passe, e a única que lê `passwordHash`.
// Sem `AUTH_DATABASE_URL` a autenticação falha de forma visível (nunca recorre à ligação de negócio).
const globalForPrisma = globalThis as unknown as { prismaAuth?: PrismaClient };

function criarCliente(): PrismaClient {
  const url = process.env.AUTH_DATABASE_URL;
  if (!url)
    throw new Error("AUTH_DATABASE_URL não definida (ver .env.example e docs/migracoes.md)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

function obter(): PrismaClient {
  globalForPrisma.prismaAuth ??= criarCliente();
  return globalForPrisma.prismaAuth;
}

export const dbAuth = new Proxy({} as PrismaClient, {
  get: (_alvo, propriedade) => Reflect.get(obter(), propriedade),
});
