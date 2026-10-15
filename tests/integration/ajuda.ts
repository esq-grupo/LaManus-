import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { sincronizarPapeisEPermissoes } from "@/server/authz/sincronizar";
import { hashPassword } from "@/server/auth/password";
import type { Papel } from "@/server/authz";
import { db } from "@/server/db";

export const PASSWORD_TESTE = "Teste-Local-9xK2pLm";
export { db };

let sincronizado = false;
export async function prepararBd() {
  if (sincronizado) return;
  const cliente = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await sincronizarPapeisEPermissoes(cliente);
  await cliente.$disconnect();
  sincronizado = true;
}

export async function criarUser(
  papeis: Papel[],
  opcoes: { estado?: "ACTIVO" | "BLOQUEADO" | "DESACTIVADO" } = {},
) {
  await prepararBd();
  const roles = await db.role.findMany({ where: { codigo: { in: papeis } } });
  const email = `t-${randomUUID().slice(0, 8)}@teste.lamanu.test`;
  const user = await db.user.create({
    data: {
      email,
      nome: "Utilizador de Teste",
      passwordHash: await hashPassword(PASSWORD_TESTE),
      estado: opcoes.estado ?? "ACTIVO",
      papeis: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  return { id: user.id, email, papeis };
}

export async function limparUser(id: string) {
  await db.session.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } }).catch(() => undefined);
}

/**
 * Faz falhar (com um trigger temporário) a inserção de um evento de auditoria de uma acção concreta e verifica que a operação
 * inteira falha. Serve para provar que a alteração e a auditoria gravam-se juntas ou não se grava nada.
 */
export async function comFalhaDeAuditoria(acao: string, fn: () => Promise<unknown>) {
  const nome = `falha_${acao.toLowerCase()}`;
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION ${nome}() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha simulada da auditoria'; END; $$ LANGUAGE plpgsql`,
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER ${nome} BEFORE INSERT ON "EventoAuditoria" FOR EACH ROW WHEN (NEW.acao = '${acao}') EXECUTE FUNCTION ${nome}()`,
  );
  try {
    await fn().then(
      () => {
        throw new Error(`A operação devia ter falhado quando a auditoria de ${acao} falha`);
      },
      (e: Error) => {
        if (e.message.startsWith("A operação devia")) throw e;
      },
    );
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER ${nome} ON "EventoAuditoria"`);
    await db.$executeRawUnsafe(`DROP FUNCTION ${nome}()`);
  }
}
