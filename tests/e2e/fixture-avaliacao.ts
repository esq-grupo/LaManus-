// Dados próprios de um teste e2e de avaliação: turma, disciplina, 2 estudantes, encarregado com conta e ligação verificada.
// Usa o docente fictício do seed (docente@…) e é limpo no fim — os testes não dependem do estado deixado por outros.
import { db } from "../../src/server/db";
import { hashPassword } from "../../src/server/auth/password";

export interface FixtureAvaliacao {
  sufixo: string;
  disciplina: string;
  emailEncarregado: string;
  nomeEstudante: string;
  periodoInicio: string;
  ids: IdsFixture;
}

export interface IdsFixture {
  anoId: string;
  periodoId: string;
  classeId: string;
  turmaId: string;
  disciplinaId: string;
  estudanteIds: string[];
  encarregadoId: string;
  userId: string;
}

export async function criarFixtureAvaliacao(senha: string): Promise<FixtureAvaliacao> {
  const sufixo = Date.now().toString().slice(-8);
  const base = 3000 + Math.floor(Math.random() * 5000);
  const docente = await db.funcionario.findFirstOrThrow({
    where: { user: { email: "docente@exemplo.lamanu.test" } },
  });
  const roleEnc = await db.role.findUniqueOrThrow({ where: { codigo: "ENCARREGADO" } });

  const ano = await db.anoLectivo.create({
    data: {
      nome: `E2E-AV-${sufixo}`,
      inicio: new Date(`${base}-09-01`),
      fim: new Date(`${base + 1}-07-15`),
    },
  });
  const periodo = await db.periodo.create({
    data: {
      anoLectivoId: ano.id,
      ordem: 1,
      nome: "1.º trimestre",
      inicio: new Date(`${base}-09-01`),
      fim: new Date(`${base}-12-15`),
    },
  });
  const classe = await db.classe.create({
    data: { nome: `E2E-C-${sufixo}`, ordem: 500 + Number(sufixo.slice(-5)) },
  });
  const turma = await db.turma.create({
    data: { nome: "A", turno: "Manhã", classeId: classe.id, anoLectivoId: ano.id },
  });
  const disciplina = await db.disciplina.create({ data: { nome: `Disc E2E ${sufixo}` } });
  await db.turmaDisciplina.create({
    data: { turmaId: turma.id, disciplinaId: disciplina.id, docenteId: docente.id },
  });

  const nomeEstudante = `Aluno Notas ${sufixo}`;
  const e1 = await db.estudante.create({
    data: {
      numeroProcesso: `AV1-${sufixo}`,
      nome: nomeEstudante,
      dataNascimento: new Date("2012-01-01"),
    },
  });
  const e2 = await db.estudante.create({
    data: {
      numeroProcesso: `AV2-${sufixo}`,
      nome: `Colega Notas ${sufixo}`,
      dataNascimento: new Date("2012-02-02"),
    },
  });
  for (const e of [e1, e2])
    await db.matricula.create({
      data: { estudanteId: e.id, turmaId: turma.id, anoLectivoId: ano.id, tipo: "NOVA" },
    });

  const emailEncarregado = `enc-av-${sufixo}@exemplo.lamanu.test`;
  const user = await db.user.create({
    data: {
      email: emailEncarregado,
      nome: "Encarregado E2E Notas",
      passwordHash: await hashPassword(senha),
      papeis: { create: [{ roleId: roleEnc.id }] },
    },
  });
  const enc = await db.encarregado.create({
    data: { nome: "Encarregado E2E Notas", userId: user.id },
  });
  await db.estudanteEncarregado.create({
    data: { estudanteId: e1.id, encarregadoId: enc.id, parentesco: "Pai", verificado: true },
  });

  return {
    sufixo,
    disciplina: disciplina.nome,
    emailEncarregado,
    nomeEstudante,
    periodoInicio: `${base}-09-10`,
    ids: {
      anoId: ano.id,
      periodoId: periodo.id,
      classeId: classe.id,
      turmaId: turma.id,
      disciplinaId: disciplina.id,
      estudanteIds: [e1.id, e2.id],
      encarregadoId: enc.id,
      userId: user.id,
    },
  };
}

export async function limparFixtureAvaliacao(ids: IdsFixture): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.permitir_correcao', 'on', true)`;
    await tx.nota.deleteMany({ where: { avaliacao: { anoLectivoId: ids.anoId } } });
    await tx.avaliacao.deleteMany({ where: { anoLectivoId: ids.anoId } });
    await tx.pautaPublicacao.deleteMany({ where: { anoLectivoId: ids.anoId } });
  });
  await db.matricula.deleteMany({ where: { anoLectivoId: ids.anoId } });
  await db.estudanteEncarregado.deleteMany({ where: { encarregadoId: ids.encarregadoId } });
  await db.session.deleteMany({ where: { userId: ids.userId } });
  await db.encarregado.delete({ where: { id: ids.encarregadoId } });
  await db.user.delete({ where: { id: ids.userId } });
  await db.estudante.deleteMany({ where: { id: { in: ids.estudanteIds } } });
  await db.turmaDisciplina.deleteMany({ where: { turmaId: ids.turmaId } });
  await db.turma.delete({ where: { id: ids.turmaId } });
  await db.periodo.delete({ where: { id: ids.periodoId } });
  await db.anoLectivo.delete({ where: { id: ids.anoId } });
  await db.disciplina.delete({ where: { id: ids.disciplinaId } });
  await db.classe.delete({ where: { id: ids.classeId } });
}
