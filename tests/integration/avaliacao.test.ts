import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { PAPEIS, type Papel } from "@/server/authz";
import { criarAvaliacao, lancarNotas } from "@/server/modules/avaliacao";
import { corrigirNota, publicarPauta, reabrirPauta, validarPauta } from "@/server/modules/pautas";
import { comFalhaDeAuditoria, db, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

/** Turma com 2 estudantes matriculados, 3 períodos e uma disciplina leccionada por um docente. */
async function montar() {
  const docente = await c.principal("DOCENTE");
  const func = await c.funcionario(docente.id);
  const ano = await c.ano();
  const [p1, p2] = await c.periodosDoAno(ano);
  const classe = await c.classe();
  const turma = await c.turma(ano.id, classe.id);
  const disc = await c.disciplina();
  const td = await db.turmaDisciplina.create({
    data: { turmaId: turma.id, disciplinaId: disc.id, docenteId: func.id },
  });
  const e1 = await c.estudante();
  const e2 = await c.estudante();
  await c.matricular(e1.id, turma.id, ano.id);
  await c.matricular(e2.id, turma.id, ano.id);
  const direccao = await c.principal("DIRECCAO");
  const dia = (p: { inicio: Date }, dias = 5) =>
    new Date(p.inicio.getTime() + dias * 864e5).toISOString().slice(0, 10);
  return { docente, func, ano, p1, p2, turma, td, e1, e2, direccao, dia };
}
type Cena = Awaited<ReturnType<typeof montar>>;

const nova = (x: Cena, extra: Record<string, unknown> = {}) =>
  criarAvaliacao(x.docente, {
    turmaDisciplinaId: x.td.id,
    periodoId: x.p1.id,
    tipo: "TESTE",
    nome: "Teste 1",
    peso: 40,
    data: x.dia(x.p1),
    ...extra,
  });

async function pautaCompleta(x: Cena) {
  const a = await nova(x);
  await lancarNotas(x.docente, a, [
    { estudanteId: x.e1.id, valor: "14,5" },
    { estudanteId: x.e2.id, valor: "10" },
  ]);
  return a;
}

describe("avaliações e notas — só o docente da disciplina", () => {
  it("o docente cria a avaliação e lança notas (14,5 → 1450); alteração fica auditada com antes/depois", async () => {
    const x = await montar();
    const a = await nova(x);
    expect(
      await lancarNotas(x.docente, a, [
        { estudanteId: x.e1.id, valor: "14,5" },
        { estudanteId: x.e2.id, valor: "" },
      ]),
    ).toEqual({ criadas: 1, alteradas: 0 });
    expect(
      (await db.nota.findFirstOrThrow({ where: { avaliacaoId: a, estudanteId: x.e1.id } })).valor,
    ).toBe(1450);
    expect(await db.nota.count({ where: { avaliacaoId: a, estudanteId: x.e2.id } })).toBe(0); // vazio não grava
    expect(await lancarNotas(x.docente, a, [{ estudanteId: x.e1.id, valor: "15" }])).toEqual({
      criadas: 0,
      alteradas: 1,
    });
    expect(await lancarNotas(x.docente, a, [{ estudanteId: x.e1.id, valor: "15" }])).toEqual({
      criadas: 0,
      alteradas: 0,
    }); // igual: sem ruído
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "NOTA_ALTERADA", actorId: x.docente.id },
    });
    expect(ev?.antes).toEqual({ valor: 1450 });
    expect(ev?.depois).toMatchObject({ valor: 1500 });
  });

  it("OUTRO docente não cria avaliações nem lança notas nesta disciplina (recusado e auditado); nada fica gravado", async () => {
    const x = await montar();
    const a = await nova(x);
    const outro = await c.principal("DOCENTE");
    await c.funcionario(outro.id);
    await expect(
      criarAvaliacao(outro, {
        turmaDisciplinaId: x.td.id,
        periodoId: x.p1.id,
        tipo: "TESTE",
        nome: "Intruso",
        peso: 10,
        data: x.dia(x.p1),
      }),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(
      lancarNotas(outro, a, [{ estudanteId: x.e1.id, valor: "20" }]),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    expect(await db.avaliacao.count({ where: { turmaDisciplinaId: x.td.id } })).toBe(1);
    expect(await db.nota.count({ where: { avaliacaoId: a } })).toBe(0);
    const negados = await db.eventoAuditoria.count({
      where: { actorId: outro.id, acao: "ACESSO_NEGADO" },
    });
    expect(negados).toBe(2);
  });

  it("docente da MESMA disciplina mas de OUTRA turma também é recusado", async () => {
    const x = await montar();
    const a = await nova(x);
    const outro = await c.principal("DOCENTE");
    const fOutro = await c.funcionario(outro.id);
    const turmaB = await c.turma(x.ano.id, (await c.classe()).id, "B");
    await db.turmaDisciplina.create({
      data: { turmaId: turmaB.id, disciplinaId: x.td.disciplinaId, docenteId: fOutro.id },
    });
    await expect(
      lancarNotas(outro, a, [{ estudanteId: x.e1.id, valor: "12" }]),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
  });

  it("todos os papéis que não são Docente são recusados (a Direcção só vê)", async () => {
    const x = await montar();
    const a = await nova(x);
    for (const papel of PAPEIS.filter((p) => p !== "DOCENTE")) {
      const u = await c.principal(papel as Papel);
      await expect(
        criarAvaliacao(u, {
          turmaDisciplinaId: x.td.id,
          periodoId: x.p1.id,
          tipo: "TESTE",
          nome: "Indevida",
          peso: 10,
          data: x.dia(x.p1),
        }),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(
        lancarNotas(u, a, [{ estudanteId: x.e1.id, valor: "20" }]),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    expect(await db.nota.count({ where: { avaliacaoId: a } })).toBe(0);
  });

  it("valores inválidos recusam o lote INTEIRO (nada fica gravado)", async () => {
    const x = await montar();
    const a = await nova(x);
    for (const mau of ["21", "-1", "abc", "14,555", "20,01"]) {
      await expect(
        lancarNotas(x.docente, a, [
          { estudanteId: x.e1.id, valor: "10" },
          { estudanteId: x.e2.id, valor: mau },
        ]),
        mau,
      ).rejects.toBeInstanceOf(ErroValidacao);
    }
    expect(await db.nota.count({ where: { avaliacaoId: a } })).toBe(0);
  });

  it("estudante sem matrícula activa nesta turma → lote inteiro recusado", async () => {
    const x = await montar();
    const a = await nova(x);
    const estranho = await c.estudante();
    await expect(
      lancarNotas(x.docente, a, [
        { estudanteId: x.e1.id, valor: "10" },
        { estudanteId: estranho.id, valor: "10" },
      ]),
    ).rejects.toThrow(/matrícula activa/);
    expect(await db.nota.count({ where: { avaliacaoId: a } })).toBe(0);
    // Matrícula transferida/anulada também não conta.
    await db.matricula.updateMany({
      where: { estudanteId: x.e2.id },
      data: { estado: "TRANSFERIDA" },
    });
    await expect(
      lancarNotas(x.docente, a, [{ estudanteId: x.e2.id, valor: "10" }]),
    ).rejects.toThrow(/matrícula activa/);
  });

  it("avaliação: peso 1–100, data dentro do período, período do mesmo ano, tipo válido", async () => {
    const x = await montar();
    await expect(nova(x, { peso: 0 })).rejects.toThrow(/peso mínimo/);
    await expect(nova(x, { peso: 101 })).rejects.toThrow(/peso máximo/);
    await expect(nova(x, { peso: 10.5 })).rejects.toThrow(/inteiro/);
    await expect(nova(x, { data: x.dia(x.p2) })).rejects.toThrow(/dentro do período/);
    await expect(nova(x, { tipo: "OUTRA" })).rejects.toThrow(/Tipo/);
    const outroAno = await c.ano("PLANEADO", 2);
    const [q1] = await c.periodosDoAno(outroAno);
    await expect(nova(x, { periodoId: q1.id })).rejects.toThrow(/não pertence ao ano/);
    expect(await db.avaliacao.count({ where: { turmaDisciplinaId: x.td.id } })).toBe(0);
  });

  it("a BASE DE DADOS recusa período de outro ano, disciplina de outra turma, nota > 20 e peso 0 (sem passar pelo serviço)", async () => {
    const x = await montar();
    const outroAno = await c.ano("PLANEADO", 3);
    const [q1] = await c.periodosDoAno(outroAno);
    const base = {
      turmaDisciplinaId: x.td.id,
      turmaId: x.turma.id,
      anoLectivoId: x.ano.id,
      periodoId: x.p1.id,
      tipo: "TESTE" as const,
      nome: "Directa",
      peso: 10,
      data: x.p1.inicio,
    };
    await expect(db.avaliacao.create({ data: { ...base, periodoId: q1.id } })).rejects.toThrow();
    const turmaB = await c.turma(x.ano.id, (await c.classe()).id, "Z");
    await expect(db.avaliacao.create({ data: { ...base, turmaId: turmaB.id } })).rejects.toThrow();
    await expect(db.avaliacao.create({ data: { ...base, peso: 0 } })).rejects.toThrow();
    const ok = await db.avaliacao.create({ data: base });
    await expect(
      db.nota.create({ data: { avaliacaoId: ok.id, estudanteId: x.e1.id, valor: 2001 } }),
    ).rejects.toThrow();
    await expect(
      db.nota.create({ data: { avaliacaoId: ok.id, estudanteId: x.e1.id, valor: -1 } }),
    ).rejects.toThrow();
  });

  it("CONCORRÊNCIA: 10 lançamentos simultâneos da mesma nota → uma só linha, com um dos valores", async () => {
    const x = await montar();
    const a = await nova(x);
    const r = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        lancarNotas(x.docente, a, [{ estudanteId: x.e1.id, valor: String(10 + (i % 5)) }]),
      ),
    );
    expect(await db.nota.count({ where: { avaliacaoId: a, estudanteId: x.e1.id } })).toBe(1);
    expect(r.some((q) => q.status === "fulfilled")).toBe(true);
  });
});

describe("pauta: validar → publicar (e o que fica bloqueado)", () => {
  it("só se valida com TODAS as notas lançadas e pelo menos uma avaliação", async () => {
    const x = await montar();
    await expect(validarPauta(x.direccao, x.turma.id, x.p1.id)).rejects.toThrow(
      /Não há avaliações/,
    );
    const a = await nova(x);
    await lancarNotas(x.docente, a, [{ estudanteId: x.e1.id, valor: "14" }]);
    await expect(validarPauta(x.direccao, x.turma.id, x.p1.id)).rejects.toThrow(/Faltam 1 nota/);
    await lancarNotas(x.docente, a, [{ estudanteId: x.e2.id, valor: "12" }]);
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    expect(
      (
        await db.pautaPublicacao.findFirstOrThrow({
          where: { turmaId: x.turma.id, periodoId: x.p1.id },
        })
      ).estado,
    ).toBe("VALIDADA");
  });

  it("VALIDADA: o docente já não altera notas nem cria avaliações — nem pelo serviço, nem directamente na BD", async () => {
    const x = await montar();
    const a = await pautaCompleta(x);
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await expect(
      lancarNotas(x.docente, a, [{ estudanteId: x.e1.id, valor: "20" }]),
    ).rejects.toThrow(/já não aceita alterações|validada/);
    await expect(nova(x, { nome: "Tarde demais" })).rejects.toThrow(/validada/);
    // Caminho directo à BD (gatilho):
    await expect(
      db.nota.updateMany({ where: { avaliacaoId: a }, data: { valor: 2000 } }),
    ).rejects.toThrow(/já não aceita alterações/);
    await expect(db.nota.deleteMany({ where: { avaliacaoId: a } })).rejects.toThrow(
      /já não aceita alterações/,
    );
    await expect(db.avaliacao.update({ where: { id: a }, data: { peso: 99 } })).rejects.toThrow(
      /já não aceita alterações/,
    );
    await expect(db.avaliacao.delete({ where: { id: a } })).rejects.toThrow(
      /já não aceita alterações/,
    );
    expect(
      (await db.nota.findFirstOrThrow({ where: { avaliacaoId: a, estudanteId: x.e1.id } })).valor,
    ).toBe(1450);
  });

  it("reabrir exige motivo e devolve o controlo ao docente; publicar só de VALIDADA; PUBLICADA não reabre", async () => {
    const x = await montar();
    const a = await pautaCompleta(x);
    await expect(publicarPauta(x.direccao, x.turma.id, x.p1.id)).rejects.toThrow(
      /só se publica uma pauta validada/,
    );
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await expect(reabrirPauta(x.direccao, x.turma.id, x.p1.id, "x")).rejects.toThrow(/motivo/);
    await reabrirPauta(x.direccao, x.turma.id, x.p1.id, "Faltava corrigir uma nota");
    await lancarNotas(x.docente, a, [{ estudanteId: x.e1.id, valor: "16" }]); // volta a poder
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    await expect(reabrirPauta(x.direccao, x.turma.id, x.p1.id, "Quero reabrir")).rejects.toThrow(
      /publicada não se reabre/,
    );
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "PAUTA_REABERTA", actorId: x.direccao.id },
    });
    expect(ev?.depois).toMatchObject({ estado: "RASCUNHO", motivo: "Faltava corrigir uma nota" });
  });

  it("a BASE DE DADOS recusa transições inválidas e apagar pautas (PUBLICADA é definitiva)", async () => {
    const x = await montar();
    await pautaCompleta(x);
    const chave = { turmaId_periodoId: { turmaId: x.turma.id, periodoId: x.p1.id } };
    await expect(
      db.pautaPublicacao.update({
        where: chave,
        data: { estado: "PUBLICADA", publicadaEm: new Date(), validadaEm: new Date() },
      }),
    ).rejects.toThrow(/Transição de pauta inválida/);
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    await expect(
      db.pautaPublicacao.update({ where: chave, data: { estado: "RASCUNHO", publicadaEm: null } }),
    ).rejects.toThrow();
    await expect(
      db.pautaPublicacao.update({ where: chave, data: { estado: "VALIDADA" } }),
    ).rejects.toThrow();
    await expect(db.pautaPublicacao.delete({ where: chave })).rejects.toThrow(/não se apagam/);
  });

  it("validar, publicar e reabrir: só a Direcção (os outros 8 papéis são recusados)", async () => {
    const x = await montar();
    await pautaCompleta(x);
    for (const papel of PAPEIS.filter((p) => p !== "DIRECCAO")) {
      const u = await c.principal(papel as Papel);
      await expect(validarPauta(u, x.turma.id, x.p1.id), papel).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
      await expect(publicarPauta(u, x.turma.id, x.p1.id), papel).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
      await expect(
        reabrirPauta(u, x.turma.id, x.p1.id, "Tentativa indevida"),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    expect(
      (
        await db.pautaPublicacao.findFirstOrThrow({
          where: { turmaId: x.turma.id, periodoId: x.p1.id },
        })
      ).estado,
    ).toBe("RASCUNHO");
  });

  it("CONCORRÊNCIA: validar e lançar ao mesmo tempo nunca deixam uma nota fora do que foi validado", async () => {
    for (let ronda = 0; ronda < 4; ronda++) {
      const x = await montar();
      const a = await nova(x);
      await lancarNotas(x.docente, a, [
        { estudanteId: x.e1.id, valor: "10" },
        { estudanteId: x.e2.id, valor: "10" },
      ]);
      const r = await Promise.allSettled([
        validarPauta(x.direccao, x.turma.id, x.p1.id),
        ...Array.from({ length: 5 }, (_, i) =>
          lancarNotas(x.docente, a, [
            { estudanteId: i % 2 ? x.e1.id : x.e2.id, valor: String(11 + i) },
          ]),
        ),
      ]);
      const pauta = await db.pautaPublicacao.findFirstOrThrow({
        where: { turmaId: x.turma.id, periodoId: x.p1.id },
      });
      if (pauta.estado === "VALIDADA") {
        // Nenhuma nota foi gravada depois do instante da validação.
        const depois = await db.nota.count({
          where: { avaliacaoId: a, updatedAt: { gt: pauta.validadaEm! } },
        });
        expect(depois, `ronda ${ronda}`).toBe(0);
      }
      expect(r.length).toBe(6);
    }
  });
});

describe("correcção depois de publicada (só a Direcção, com motivo)", () => {
  async function publicada() {
    const x = await montar();
    const a = await pautaCompleta(x);
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    const nota = await db.nota.findFirstOrThrow({
      where: { avaliacaoId: a, estudanteId: x.e1.id },
    });
    return { x, a, nota };
  }

  it("corrige com motivo, audita antes/depois/motivo; a pauta continua PUBLICADA", async () => {
    const { x, nota } = await publicada();
    await corrigirNota(x.direccao, nota.id, "15,5", "Erro de digitação do docente");
    expect((await db.nota.findUniqueOrThrow({ where: { id: nota.id } })).valor).toBe(1550);
    expect(
      (
        await db.pautaPublicacao.findFirstOrThrow({
          where: { turmaId: x.turma.id, periodoId: x.p1.id },
        })
      ).estado,
    ).toBe("PUBLICADA");
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "NOTA_CORRIGIDA_APOS_PUBLICACAO", entidadeId: nota.id },
    });
    expect(ev?.antes).toEqual({ valor: 1450 });
    expect(ev?.depois).toMatchObject({ valor: 1550, motivo: "Erro de digitação do docente" });
    expect(ev?.actorId).toBe(x.direccao.id);
  });

  it("exige motivo e valor válido; recusa valor igual", async () => {
    const { x, nota } = await publicada();
    await expect(corrigirNota(x.direccao, nota.id, "15", "")).rejects.toThrow(/motivo/);
    await expect(corrigirNota(x.direccao, nota.id, "15", "abcd")).rejects.toThrow(/motivo/);
    await expect(corrigirNota(x.direccao, nota.id, "25", "Motivo suficiente")).rejects.toThrow(
      /20/,
    );
    await expect(corrigirNota(x.direccao, nota.id, "14,5", "Motivo suficiente")).rejects.toThrow(
      /igual/,
    );
  });

  it("só a Direcção corrige; o Docente (que lançou) e os restantes são recusados", async () => {
    const { x, nota } = await publicada();
    for (const papel of PAPEIS.filter((p) => p !== "DIRECCAO")) {
      const u = papel === "DOCENTE" ? x.docente : await c.principal(papel as Papel);
      await expect(
        corrigirNota(u, nota.id, "20", "Tentativa indevida"),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    expect((await db.nota.findUniqueOrThrow({ where: { id: nota.id } })).valor).toBe(1450);
  });

  it("só em pauta PUBLICADA (em rascunho o docente edita; validada reabre-se)", async () => {
    const x = await montar();
    const a = await pautaCompleta(x);
    const nota = await db.nota.findFirstOrThrow({
      where: { avaliacaoId: a, estudanteId: x.e1.id },
    });
    await expect(corrigirNota(x.direccao, nota.id, "15", "Motivo suficiente")).rejects.toThrow(
      /rascunho/,
    );
    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await expect(corrigirNota(x.direccao, nota.id, "15", "Motivo suficiente")).rejects.toThrow(
      /validada/,
    );
  });

  it("fora do serviço de correcção, alterar uma nota publicada na BD falha", async () => {
    const { nota } = await publicada();
    await expect(db.nota.update({ where: { id: nota.id }, data: { valor: 2000 } })).rejects.toThrow(
      /já não aceita alterações/,
    );
  });
});

describe("auditoria atómica — avaliação e pautas", () => {
  it("se a auditoria falhar, nada fica gravado (avaliação, nota, validação, publicação, correcção)", async () => {
    const x = await montar();
    await comFalhaDeAuditoria("AVALIACAO_CRIADA", () => nova(x));
    expect(await db.avaliacao.count({ where: { turmaDisciplinaId: x.td.id } })).toBe(0);

    const a = await nova(x);
    await comFalhaDeAuditoria("NOTA_LANCADA", () =>
      lancarNotas(x.docente, a, [
        { estudanteId: x.e1.id, valor: "10" },
        { estudanteId: x.e2.id, valor: "11" },
      ]),
    );
    expect(await db.nota.count({ where: { avaliacaoId: a } })).toBe(0);

    await lancarNotas(x.docente, a, [
      { estudanteId: x.e1.id, valor: "10" },
      { estudanteId: x.e2.id, valor: "11" },
    ]);
    await comFalhaDeAuditoria("PAUTA_VALIDADA", () =>
      validarPauta(x.direccao, x.turma.id, x.p1.id),
    );
    expect(
      (
        await db.pautaPublicacao.findFirstOrThrow({
          where: { turmaId: x.turma.id, periodoId: x.p1.id },
        })
      ).estado,
    ).toBe("RASCUNHO");

    await validarPauta(x.direccao, x.turma.id, x.p1.id);
    await comFalhaDeAuditoria("PAUTA_PUBLICADA", () =>
      publicarPauta(x.direccao, x.turma.id, x.p1.id),
    );
    expect(
      (
        await db.pautaPublicacao.findFirstOrThrow({
          where: { turmaId: x.turma.id, periodoId: x.p1.id },
        })
      ).estado,
    ).toBe("VALIDADA");

    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    const nota = await db.nota.findFirstOrThrow({
      where: { avaliacaoId: a, estudanteId: x.e1.id },
    });
    await comFalhaDeAuditoria("NOTA_CORRIGIDA_APOS_PUBLICACAO", () =>
      corrigirNota(x.direccao, nota.id, "19", "Motivo suficiente"),
    );
    expect((await db.nota.findUniqueOrThrow({ where: { id: nota.id } })).valor).toBe(1000);
  });
});
