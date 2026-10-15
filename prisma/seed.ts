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
  const turmas = [];
  for (const nome of ["A", "B"]) {
    turmas.push(
      await db.turma.upsert({
        where: { anoLectivoId_classeId_nome: { anoLectivoId: ano.id, classeId: classe.id, nome } },
        update: {},
        create: { nome, turno: "Manhã", classeId: classe.id, anoLectivoId: ano.id },
      }),
    );
  }
  const [turmaA, turmaB] = turmas as [(typeof turmas)[number], (typeof turmas)[number]];
  const trimestres = [
    ["1.º trimestre", "2026-09-01", "2026-12-15"],
    ["2.º trimestre", "2027-01-10", "2027-04-10"],
    ["3.º trimestre", "2027-04-20", "2027-07-15"],
  ] as const;
  for (const [i, [nome, inicio, fim]] of trimestres.entries()) {
    await db.periodo.upsert({
      where: { anoLectivoId_ordem: { anoLectivoId: ano.id, ordem: i + 1 } },
      update: {},
      create: {
        anoLectivoId: ano.id,
        ordem: i + 1,
        nome,
        inicio: new Date(inicio),
        fim: new Date(fim),
      },
    });
  }
  const disciplinas = [];
  for (const nome of ["Matemática", "Língua Portuguesa"]) {
    disciplinas.push(await db.disciplina.upsert({ where: { nome }, update: {}, create: { nome } }));
  }
  const contaDocente = await db.user.findUniqueOrThrow({
    where: { email: "docente@exemplo.lamanu.test" },
  });
  const docente =
    (await db.funcionario.findUnique({ where: { userId: contaDocente.id } })) ??
    (await db.funcionario.create({
      data: { nome: "Docente Fictício", cargo: "Docente", userId: contaDocente.id },
    }));
  for (const d of disciplinas) {
    await db.turmaDisciplina.upsert({
      where: { turmaId_disciplinaId: { turmaId: turmaA.id, disciplinaId: d.id } },
      update: {},
      create: { turmaId: turmaA.id, disciplinaId: d.id, docenteId: docente.id },
    });
  }
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

  // Matrículas e encarregado fictícios: 1 ligação verificada, 1 por verificar, 1 verificada mas com autorização revogada.
  const estudante = (n: number) =>
    db.estudante.findUniqueOrThrow({ where: { numeroProcesso: `TESTE-000${n}` } });
  for (const [n, turma] of [
    [1, turmaA],
    [2, turmaB],
  ] as const) {
    const e = await estudante(n);
    const jaTem = await db.matricula.findFirst({
      where: { estudanteId: e.id, estado: "ACTIVA", anoLectivoId: ano.id },
    });
    if (!jaTem)
      await db.matricula.create({
        data: { estudanteId: e.id, turmaId: turma.id, anoLectivoId: ano.id, tipo: "NOVA" },
      });
  }
  const contaEncarregado = await db.user.findUniqueOrThrow({
    where: { email: "encarregado@exemplo.lamanu.test" },
  });
  const encarregado = await db.encarregado.upsert({
    where: { bi: "ENC-SEED-0001" },
    update: { userId: contaEncarregado.id },
    create: {
      nome: "Encarregado Fictício",
      bi: "ENC-SEED-0001",
      contacto: "900000000",
      userId: contaEncarregado.id,
    },
  });
  const ligacoes = [
    [1, { verificado: true, autorizacaoActiva: true, principal: true }],
    [2, { verificado: false, autorizacaoActiva: true, principal: false }],
    [3, { verificado: true, autorizacaoActiva: false, principal: false }],
  ] as const;
  for (const [n, estado] of ligacoes) {
    const e = await estudante(n);
    await db.estudanteEncarregado.upsert({
      where: { estudanteId_encarregadoId: { estudanteId: e.id, encarregadoId: encarregado.id } },
      update: {},
      create: { estudanteId: e.id, encarregadoId: encarregado.id, parentesco: "Pai", ...estado },
    });
  }

  // Avaliação fictícia do TESTE-0001 na turma A: 1.º período PUBLICADO, 2.º VALIDADO (ainda não publicado), 3.º em RASCUNHO.
  const direccao = await db.user.findUniqueOrThrow({
    where: { email: "direccao@exemplo.lamanu.test" },
  });
  const [p1, p2, p3] = await db.periodo.findMany({
    where: { anoLectivoId: ano.id },
    orderBy: { ordem: "asc" },
  });
  const tdA = await db.turmaDisciplina.findMany({
    where: { turmaId: turmaA.id },
    include: { disciplina: true },
  });
  const matematica = tdA.find((t) => t.disciplina.nome === "Matemática")!;
  const portugues = tdA.find((t) => t.disciplina.nome === "Língua Portuguesa")!;
  const aluno1 = await estudante(1);
  const avaliar = async (
    td: typeof matematica,
    periodo: NonNullable<typeof p1>,
    nome: string,
    peso: number,
    valor: number,
  ) => {
    if (
      await db.avaliacao.findFirst({
        where: { turmaDisciplinaId: td.id, periodoId: periodo.id, nome },
      })
    )
      return;
    const a = await db.avaliacao.create({
      data: {
        turmaDisciplinaId: td.id,
        turmaId: turmaA.id,
        anoLectivoId: ano.id,
        periodoId: periodo.id,
        tipo: "TESTE",
        nome,
        peso,
        data: new Date(periodo.inicio.getTime() + 5 * 864e5),
      },
    });
    await db.nota.create({
      data: { avaliacaoId: a.id, estudanteId: aluno1.id, valor, lancadaPorId: docente.userId },
    });
  };
  if (p1 && p2 && p3) {
    await avaliar(matematica, p1, "Teste 1", 40, 1450);
    await avaliar(matematica, p1, "Exame", 60, 1600);
    await avaliar(portugues, p1, "Teste de Português", 100, 1300);
    await avaliar(matematica, p2, "Teste 2", 100, 1700);
    await avaliar(matematica, p3, "Teste 3", 100, 1888);
    const avancar = async (periodoId: string, ate: "VALIDADA" | "PUBLICADA") => {
      const chave = { turmaId_periodoId: { turmaId: turmaA.id, periodoId } };
      await db.pautaPublicacao.upsert({
        where: chave,
        update: {},
        create: { turmaId: turmaA.id, periodoId, anoLectivoId: ano.id },
      });
      let pauta = await db.pautaPublicacao.findUniqueOrThrow({ where: chave });
      if (pauta.estado === "RASCUNHO") {
        pauta = await db.pautaPublicacao.update({
          where: chave,
          data: { estado: "VALIDADA", validadaPorId: direccao.id, validadaEm: new Date() },
        });
      }
      if (ate === "PUBLICADA" && pauta.estado === "VALIDADA") {
        await db.pautaPublicacao.update({
          where: chave,
          data: { estado: "PUBLICADA", publicadaPorId: direccao.id, publicadaEm: new Date() },
        });
      }
    };
    await avancar(p1.id, "PUBLICADA");
    await avancar(p2.id, "VALIDADA");
  }
  console.log("Seed fictício concluído.");
}

main().finally(() => db.$disconnect());
