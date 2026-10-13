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
