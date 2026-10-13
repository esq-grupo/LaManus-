// Seed com dados EXCLUSIVAMENTE FICTÍCIOS. Nunca usar dados reais de alunos.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
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
  console.log("Seed fictício concluído.");
}

main().finally(() => db.$disconnect());
