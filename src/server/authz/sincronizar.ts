import type { PrismaClient } from "@/generated/prisma/client";
import { NOMES_PAPEIS, PAPEIS, PERMISSOES, PERMISSOES_POR_PAPEL } from "./permissoes";

/** Garante que os papéis/permissões na BD coincidem com o catálogo em código (idempotente). */
export async function sincronizarPapeisEPermissoes(db: PrismaClient): Promise<void> {
  for (const [codigo, descricao] of Object.entries(PERMISSOES)) {
    await db.permission.upsert({
      where: { codigo },
      update: { descricao },
      create: { codigo, descricao },
    });
  }
  for (const codigo of PAPEIS) {
    const role = await db.role.upsert({
      where: { codigo },
      update: { nome: NOMES_PAPEIS[codigo] },
      create: { codigo, nome: NOMES_PAPEIS[codigo] },
    });
    const perms = await db.permission.findMany({
      where: { codigo: { in: [...PERMISSOES_POR_PAPEL[codigo]] } },
    });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }
}
