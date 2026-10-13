// Seed com dados EXCLUSIVAMENTE FICTÍCIOS. Nunca usar dados reais de alunos.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/server/auth/password";
import { PAPEIS } from "../src/server/authz/permissoes";
import { sincronizarPapeisEPermissoes } from "../src/server/authz/sincronizar";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("O seed de desenvolvimento não pode correr em produção.");
  const passwordDev = process.env.SEED_PASSWORD;
  if (!passwordDev)
    throw new Error("Defina SEED_PASSWORD (valor fictício de desenvolvimento, ver .env.example).");

  await sincronizarPapeisEPermissoes(db);
  const passwordHash = await hashPassword(passwordDev);
  for (const papel of PAPEIS) {
    const email = `${papel.toLowerCase().replace(/_/g, ".")}@exemplo.lamanu.test`;
    const role = await db.role.findUniqueOrThrow({ where: { codigo: papel } });
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, nome: `Utilizador Fictício ${papel}`, passwordHash },
    });
    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
  const ano = await db.anoLectivo.upsert({
    where: { nome: "2026/2027 (fictício)" },
    update: {},
    create: {
      nome: "2026/2027 (fictício)",
      inicio: new Date("2026-09-01"),
      fim: new Date("2027-07-15"),
      estado: "ACTIVO",
    },
  });
  const classe = await db.classe.upsert({
    where: { nome: "7.ª classe" },
    update: {},
    create: { nome: "7.ª classe", ordem: 7 },
  });
  await db.turma.upsert({
    where: { anoLectivoId_classeId_nome: { anoLectivoId: ano.id, classeId: classe.id, nome: "A" } },
    update: {},
    create: { nome: "A", turno: "Manhã", classeId: classe.id, anoLectivoId: ano.id },
  });
  for (let i = 1; i <= 5; i++) {
    const numeroProcesso = `TESTE-${String(i).padStart(4, "0")}`;
    await db.estudante.upsert({
      where: { numeroProcesso },
      update: {},
      create: {
        numeroProcesso,
        nome: `Estudante Fictício ${i}`,
        dataNascimento: new Date(`201${i % 3}-0${i}-15`),
      },
    });
  }
  const contaEstudante = await db.user.findUniqueOrThrow({
    where: { email: "estudante@exemplo.lamanu.test" },
  });
  await db.estudante.update({
    where: { numeroProcesso: "TESTE-0001" },
    data: { userId: contaEstudante.id },
  });
  console.log("Seed fictício concluído.");
}

main().finally(() => db.$disconnect());
