import { randomUUID } from "node:crypto";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { sincronizarPapeisEPermissoes } from "@/server/authz/sincronizar";
import { hashPassword } from "@/server/auth/password";
import type { Papel } from "@/server/authz";
import { db } from "@/server/db";
import { iniciarSessao } from "@/server/auth/login";
import { corrigirNota } from "@/server/modules/pautas";
import type { Principal } from "@/server/authz";
import { criarClienteAdmin } from "../../scripts/db-admin";

export const PASSWORD_TESTE = "Teste-Local-9xK2pLm";
export { db };

/**
 * Ligação de ADMINISTRAÇÃO (dono das tabelas) — só para preparar/limpar dados e criar estruturas de teste (DDL).
 * `db` (o código da aplicação) corre com o papel restrito `lamanus_app`: os testes de «SQL directo» usam `db`.
 */
export const dbAdmin = criarClienteAdmin();

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
  await dbAdmin.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION ${nome}() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha simulada da auditoria'; END; $$ LANGUAGE plpgsql`,
  );
  await dbAdmin.$executeRawUnsafe(
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
    await dbAdmin.$executeRawUnsafe(`DROP TRIGGER ${nome} ON "EventoAuditoria"`);
    await dbAdmin.$executeRawUnsafe(`DROP FUNCTION ${nome}()`);
  }
}

/** Abre uma sessão real (login) para um utilizador de teste e devolve o TOKEN em claro, como o cookie do browser. */
export async function abrirSessao(email: string): Promise<string> {
  const r = await iniciarSessao(email, PASSWORD_TESTE);
  if (!r.ok) throw new Error(`Não foi possível abrir sessão para ${email}`);
  return r.token;
}

/** Corrige uma nota como o faria a interface: com o token da sessão REAL do utilizador. */
export async function corrigirComSessao(
  u: Principal & { email: string },
  notaId: string,
  valor: string | number,
  motivo: string,
) {
  return corrigirNota(u, notaId, valor, motivo, { tokenSessao: await abrirSessao(u.email) });
}
