// Ataques por SQL directo com a LIGAÇÃO DA APLICAÇÃO (papel restrito `lamanus_app`): nenhum pode contornar as pautas.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarAvaliacao, lancarNotas } from "@/server/modules/avaliacao";
import { corrigirNota, publicarPauta, validarPauta } from "@/server/modules/pautas";
import { db, dbAdmin, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

/** Turma com 2 estudantes, 3 períodos; período 1 PUBLICADO, período 2 e 3 em rascunho (com avaliação e notas). */
async function montar() {
  const docente = await c.principal("DOCENTE");
  const func = await c.funcionario(docente.id);
  const direccao = await c.principal("DIRECCAO");
  const ano = await c.ano();
  const [p1, p2, p3] = await c.periodosDoAno(ano);
  const turma = await c.turma(ano.id, (await c.classe()).id);
  const td = await db.turmaDisciplina.create({
    data: { turmaId: turma.id, disciplinaId: (await c.disciplina()).id, docenteId: func.id },
  });
  const e1 = await c.estudante();
  const e2 = await c.estudante();
  await c.matricular(e1.id, turma.id, ano.id);
  await c.matricular(e2.id, turma.id, ano.id);
  const dia = (p: { inicio: Date }) =>
    new Date(p.inicio.getTime() + 5 * 864e5).toISOString().slice(0, 10);
  const avaliar = async (p: typeof p1, valor: string) => {
    const a = await criarAvaliacao(docente, {
      turmaDisciplinaId: td.id,
      periodoId: p.id,
      tipo: "TESTE",
      nome: `Teste ${p.ordem}`,
      peso: 50,
      data: dia(p),
    });
    await lancarNotas(docente, a, [
      { estudanteId: e1.id, valor },
      { estudanteId: e2.id, valor },
    ]);
    return a;
  };
  const a1 = await avaliar(p1, "14");
  const a2 = await avaliar(p2, "12");
  const a3 = await avaliar(p3, "11");
  await validarPauta(direccao, turma.id, p1.id);
  await publicarPauta(direccao, turma.id, p1.id);
  const nota1 = await db.nota.findFirstOrThrow({ where: { avaliacaoId: a1, estudanteId: e1.id } });
  return { docente, direccao, ano, p1, p2, p3, turma, td, e1, e2, a1, a2, a3, nota1 };
}

describe("a aplicação NÃO tem poderes de dono na base de dados", () => {
  it("não consegue desligar gatilhos, apagar índices, fazer TRUNCATE nem assumir o papel de dono", async () => {
    await expect(
      db.$executeRawUnsafe('ALTER TABLE "Nota" DISABLE TRIGGER nota_bloqueada'),
    ).rejects.toThrow(/must be owner/);
    await expect(db.$executeRawUnsafe('DROP TRIGGER nota_bloqueada ON "Nota"')).rejects.toThrow(
      /must be owner/,
    );
    await expect(db.$executeRawUnsafe('DROP INDEX "Matricula_uma_activa_por_ano"')).rejects.toThrow(
      /must be owner/,
    );
    await expect(db.$executeRawUnsafe('TRUNCATE "Nota"')).rejects.toThrow(/permission denied/);
    await expect(db.$executeRawUnsafe('TRUNCATE "PautaPublicacao"')).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.$executeRawUnsafe("SET ROLE lamanus")).rejects.toThrow(/permission denied/);
    await expect(db.$executeRawUnsafe("SET session_replication_role = replica")).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("achado 1 — o interruptor de correcção não pode ser activado por SQL directo", () => {
  it("set_config('app.permitir_correcao','on') com a ligação da aplicação NÃO desbloqueia notas publicadas", async () => {
    const x = await montar();
    const comInterruptor = (
      accao: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<unknown>,
    ) =>
      db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.permitir_correcao', 'on', true)`;
        await accao(tx);
      });
    await expect(
      comInterruptor((tx) => tx.nota.update({ where: { id: x.nota1.id }, data: { valor: 2000 } })),
    ).rejects.toThrow();
    await expect(
      comInterruptor((tx) =>
        tx.nota.updateMany({ where: { id: x.nota1.id }, data: { valor: 2000 } }),
      ),
    ).rejects.toThrow();
    await expect(
      comInterruptor((tx) => tx.nota.deleteMany({ where: { id: x.nota1.id } })),
    ).rejects.toThrow();
    await expect(
      comInterruptor((tx) => tx.avaliacao.updateMany({ where: { id: x.a1 }, data: { peso: 99 } })),
    ).rejects.toThrow();
    await expect(
      comInterruptor((tx) => tx.avaliacao.deleteMany({ where: { id: x.a1 } })),
    ).rejects.toThrow();
    // Nada mudou:
    expect((await db.nota.findUniqueOrThrow({ where: { id: x.nota1.id } })).valor).toBe(1400);
    expect((await db.avaliacao.findUniqueOrThrow({ where: { id: x.a1 } })).peso).toBe(50);
  });

  it("a única via é o serviço de correcção (função privilegiada): exige motivo, nota de pauta PUBLICADA e deixa auditoria", async () => {
    const x = await montar();
    await corrigirNota(x.direccao, x.nota1.id, "15,5", "Erro de digitação do docente");
    expect((await db.nota.findUniqueOrThrow({ where: { id: x.nota1.id } })).valor).toBe(1550);
    // A função privilegiada recusa chamadas inválidas mesmo se invocada directamente por SQL:
    const chamar = (nota: string, valor: number, motivo: string) =>
      db.$executeRaw`SELECT corrigir_nota_publicada(${nota}::uuid, ${valor}::int, ${x.direccao.id}::uuid, ${motivo}, NULL)`;
    await expect(chamar(x.nota1.id, 1600, "x")).rejects.toThrow(/Motivo obrigatório/);
    await expect(chamar(x.nota1.id, 2001, "Motivo suficiente")).rejects.toThrow(/Valor inválido/);
    await expect(chamar(x.nota1.id, 1550, "Motivo suficiente")).rejects.toThrow(/igual/);
    const notaRascunho = await db.nota.findFirstOrThrow({ where: { avaliacaoId: x.a2 } });
    await expect(chamar(notaRascunho.id, 1000, "Motivo suficiente")).rejects.toThrow(
      /pauta publicada/,
    );
    expect((await db.nota.findUniqueOrThrow({ where: { id: notaRascunho.id } })).valor).toBe(1200);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "NOTA_CORRIGIDA_APOS_PUBLICACAO", entidadeId: x.nota1.id },
    });
    expect(ev?.antes).toEqual({ valor: 1400 });
    expect(ev?.depois).toMatchObject({ valor: 1550, motivo: "Erro de digitação do docente" });
  });
});

describe("achado 2 — mover uma nota/avaliação de uma pauta bloqueada para outra em rascunho", () => {
  it("mudar a avaliação de uma nota publicada para uma avaliação em rascunho é recusado (destino LIVRE: só o gatilho trava)", async () => {
    const x = await montar();
    // Liberta o par (a3, e1) para que a unicidade não seja o motivo da recusa.
    await dbAdmin.nota.deleteMany({ where: { avaliacaoId: x.a3, estudanteId: x.e1.id } });
    await expect(
      db.nota.update({ where: { id: x.nota1.id }, data: { avaliacaoId: x.a3 } }),
    ).rejects.toThrow();
    const e3 = await c.estudante();
    await c.matricular(e3.id, x.turma.id, x.ano.id);
    await expect(
      db.nota.update({ where: { id: x.nota1.id }, data: { estudanteId: e3.id } }),
    ).rejects.toThrow();
    const n = await db.nota.findUniqueOrThrow({ where: { id: x.nota1.id } });
    expect(n).toMatchObject({ avaliacaoId: x.a1, estudanteId: x.e1.id, valor: 1400 });
  });

  it("mover uma NOTA de rascunho para uma avaliação de pauta publicada é recusado (destino livre)", async () => {
    const x = await montar();
    await dbAdmin.nota.deleteMany({ where: { avaliacaoId: x.a1, estudanteId: x.e2.id } });
    const notaRascunho = await db.nota.findFirstOrThrow({
      where: { avaliacaoId: x.a2, estudanteId: x.e2.id },
    });
    await expect(
      db.nota.update({ where: { id: notaRascunho.id }, data: { avaliacaoId: x.a1 } }),
    ).rejects.toThrow();
  });

  it("mover uma AVALIAÇÃO de pauta (período/turma/disciplina) é recusado nos dois sentidos", async () => {
    const x = await montar();
    await expect(
      db.avaliacao.update({ where: { id: x.a1 }, data: { periodoId: x.p2.id } }),
    ).rejects.toThrow();
    await expect(
      db.avaliacao.update({ where: { id: x.a2 }, data: { periodoId: x.p1.id } }),
    ).rejects.toThrow();
    const outraTurma = await c.turma(x.ano.id, (await c.classe()).id, "Z");
    const td2 = await db.turmaDisciplina.create({
      data: { turmaId: outraTurma.id, disciplinaId: x.td.disciplinaId },
    });
    await expect(
      db.avaliacao.update({
        where: { id: x.a2 },
        data: { turmaDisciplinaId: td2.id, turmaId: outraTurma.id },
      }),
    ).rejects.toThrow();
    const a1 = await db.avaliacao.findUniqueOrThrow({ where: { id: x.a1 } });
    expect(a1.periodoId).toBe(x.p1.id);
  });
});

describe("outros vectores de SQL directo (verificação própria)", () => {
  it("inserir uma pauta já PUBLICADA/VALIDADA directamente é recusado (só nasce em RASCUNHO)", async () => {
    const x = await montar();
    const turmaNova = await c.turma(x.ano.id, (await c.classe()).id, "N"); // sem qualquer pauta
    const agora = new Date();
    const base = { turmaId: turmaNova.id, periodoId: x.p3.id, anoLectivoId: x.ano.id };
    await expect(
      db.pautaPublicacao.create({
        data: { ...base, estado: "PUBLICADA", validadaEm: agora, publicadaEm: agora },
      }),
    ).rejects.toThrow();
    await expect(
      db.pautaPublicacao.create({ data: { ...base, estado: "VALIDADA", validadaEm: agora } }),
    ).rejects.toThrow();
    await expect(
      db.pautaPublicacao.create({ data: { ...base, estado: "RASCUNHO", validadaEm: agora } }),
    ).rejects.toThrow();
    expect(await db.pautaPublicacao.count({ where: { turmaId: turmaNova.id } })).toBe(0);
    // Em rascunho, sim.
    await db.pautaPublicacao.create({ data: base });
    expect(await db.pautaPublicacao.count({ where: { turmaId: turmaNova.id } })).toBe(1);
  });

  it("uma pauta PUBLICADA não admite sequer a alteração de outras colunas", async () => {
    const x = await montar();
    const chave = { turmaId_periodoId: { turmaId: x.turma.id, periodoId: x.p1.id } };
    await expect(
      db.pautaPublicacao.update({ where: chave, data: { validadaPorId: x.docente.id } }),
    ).rejects.toThrow();
    await expect(
      db.pautaPublicacao.update({ where: chave, data: { publicadaEm: new Date() } }),
    ).rejects.toThrow();
  });

  it("as chaves de uma pauta, avaliação e nota são imutáveis (turma/período/ano)", async () => {
    const x = await montar();
    await expect(
      db.pautaPublicacao.update({
        where: { turmaId_periodoId: { turmaId: x.turma.id, periodoId: x.p2.id } },
        data: { periodoId: x.p3.id },
      }),
    ).rejects.toThrow();
    await expect(
      db.avaliacao.update({ where: { id: x.a3 }, data: { periodoId: x.p2.id } }),
    ).rejects.toThrow();
  });

  it("o dono (administração) continua a poder fazer limpezas e migrações; o gatilho distingue o papel", async () => {
    const x = await montar();
    await expect(
      dbAdmin.nota.update({ where: { id: x.nota1.id }, data: { valor: 1401 } }),
    ).resolves.toBeDefined();
    await dbAdmin.nota.update({ where: { id: x.nota1.id }, data: { valor: 1400 } });
  });
});
