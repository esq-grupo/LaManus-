import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroAutorizacao } from "@/server/erros";
import { PAPEIS, type Papel } from "@/server/authz";
import { criarAvaliacao, lancarNotas } from "@/server/modules/avaliacao";
import { notasDoEstudante } from "@/server/modules/notas-leitura";
import {
  listarPautas,
  obterPauta,
  publicarPauta,
  reabrirPauta,
  validarPauta,
} from "@/server/modules/pautas";
import { corrigirComSessao, db, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

// Valores «marcadores» únicos: se algum aparecer numa resposta de portal, é uma fuga.
const V_PUBLICADA = 1450; // período 1 — PUBLICADA
const V_VALIDADA = 1777; // período 2 — VALIDADA (ainda não publicada)
const V_RASCUNHO = 1888; // período 3 — RASCUNHO

async function montar() {
  const docente = await c.principal("DOCENTE");
  const func = await c.funcionario(docente.id);
  const direccao = await c.principal("DIRECCAO");
  const ano = await c.ano();
  const [p1, p2, p3] = await c.periodosDoAno(ano);
  const classe = await c.classe();
  const turma = await c.turma(ano.id, classe.id);
  const mat = await c.disciplina();
  const port = await c.disciplina();
  const tdMat = await db.turmaDisciplina.create({
    data: { turmaId: turma.id, disciplinaId: mat.id, docenteId: func.id },
  });
  const outroDoc = await c.principal("DOCENTE");
  const fOutro = await c.funcionario(outroDoc.id);
  const tdPort = await db.turmaDisciplina.create({
    data: { turmaId: turma.id, disciplinaId: port.id, docenteId: fOutro.id },
  });

  // Estudante com conta + encarregado verificado; e um colega (para acesso cruzado).
  const userEst = await c.principal("ESTUDANTE");
  const est = await c.estudante({ userId: userEst.id });
  const colega = await c.estudante();
  await c.matricular(est.id, turma.id, ano.id);
  await c.matricular(colega.id, turma.id, ano.id);
  const userEnc = await c.principal("ENCARREGADO");
  const enc = await c.encarregado(userEnc.id);
  await c.ligar(est.id, enc.id, { verificado: true });

  const dia = (p: { inicio: Date }) =>
    new Date(p.inicio.getTime() + 5 * 864e5).toISOString().slice(0, 10);
  const avaliar = async (
    td: typeof tdMat,
    p: typeof p1,
    quem: typeof docente,
    valor: number,
    peso = 50,
  ) => {
    const a = await criarAvaliacao(quem, {
      turmaDisciplinaId: td.id,
      periodoId: p.id,
      tipo: "TESTE",
      nome: `Teste ${p.ordem}`,
      peso,
      data: dia(p),
    });
    const v = String(valor / 100).replace(".", ",");
    await lancarNotas(quem, a, [
      { estudanteId: est.id, valor: v },
      { estudanteId: colega.id, valor: "9" },
    ]);
    return a;
  };
  await avaliar(tdMat, p1, docente, V_PUBLICADA);
  await avaliar(tdPort, p1, outroDoc, 1000);
  await avaliar(tdMat, p2, docente, V_VALIDADA);
  await avaliar(tdMat, p3, docente, V_RASCUNHO);
  for (const p of [p1, p2]) await validarPauta(direccao, turma.id, p.id).catch(() => undefined);
  return {
    docente,
    outroDoc,
    direccao,
    ano,
    p1,
    p2,
    p3,
    turma,
    userEst,
    est,
    colega,
    userEnc,
    enc,
    tdMat,
    tdPort,
  };
}
type Cena = Awaited<ReturnType<typeof montar>>;

/** Período 1 completa (Matemática + Português) → validada e publicada; período 2 só validada (se possível). */
async function prepararEstados(x: Cena) {
  // p1 já foi validada em montar(); publicar.
  await publicarPauta(x.direccao, x.turma.id, x.p1.id);
  return x;
}

const textoDe = (o: unknown) => JSON.stringify(o);

describe("NOTA NÃO PUBLICADA NUNCA SAI PARA OS PORTAIS (critério de aceitação da Entrega D)", () => {
  it("estudante: só vê o período publicado; nenhum valor/ID dos períodos validado ou em rascunho aparece na resposta", async () => {
    const x = await prepararEstados(await montar());
    const r = await notasDoEstudante(x.userEst, x.est.id);
    expect(r?.periodos.map((p) => p.periodo)).toEqual(["1.º período"]);
    const t = textoDe(r);
    expect(t).not.toContain(String(V_VALIDADA));
    expect(t).not.toContain(String(V_RASCUNHO));
    const idsNaoPublicados = await db.nota.findMany({
      where: { estudanteId: x.est.id, avaliacao: { periodoId: { in: [x.p2.id, x.p3.id] } } },
      select: { id: true, avaliacaoId: true },
    });
    expect(idsNaoPublicados.length).toBeGreaterThan(0);
    for (const n of idsNaoPublicados) {
      expect(t).not.toContain(n.id);
      expect(t).not.toContain(n.avaliacaoId);
    }
    // O estado da pauta também não é revelado aos portais.
    expect(t).not.toMatch(/RASCUNHO|VALIDADA|estadoPauta":"/);
  });

  it("encarregado (ligação verificada): vê exactamente o mesmo que o estudante — só o publicado", async () => {
    const x = await prepararEstados(await montar());
    const r = await notasDoEstudante(x.userEnc, x.est.id);
    expect(r?.periodos.map((p) => p.periodo)).toEqual(["1.º período"]);
    expect(textoDe(r)).not.toContain(String(V_VALIDADA));
    expect(textoDe(r)).not.toContain(String(V_RASCUNHO));
  });

  it("antes de qualquer publicação o portal não recebe NENHUMA nota (resposta vazia)", async () => {
    const x = await montar(); // p1 e p2 validadas, nada publicado
    expect((await notasDoEstudante(x.userEst, x.est.id))?.periodos).toEqual([]);
    expect((await notasDoEstudante(x.userEnc, x.est.id))?.periodos).toEqual([]);
  });

  it("publicar torna visível de imediato; a média usa as notas publicadas e a fórmula (ponderada, 1 casa)", async () => {
    const x = await montar();
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    const r = await notasDoEstudante(x.userEst, x.est.id);
    const p1 = r!.periodos[0]!;
    expect(p1.disciplinas).toHaveLength(2);
    const mat = p1.disciplinas.find((d) => d.avaliacoes.some((a) => a.valor === V_PUBLICADA))!;
    expect(mat.media).toBe("14,5");
    expect(p1.mediaGeral).toBe("12,3"); // (14,5 + 10,0) / 2 = 12,25 → 12,3 (meio para cima)
  });

  it("correcção depois de publicada reflecte-se no portal; a nota antiga deixa de aparecer", async () => {
    const x = await prepararEstados(await montar());
    const nota = await db.nota.findFirstOrThrow({
      where: { estudanteId: x.est.id, valor: V_PUBLICADA },
    });
    await corrigirComSessao(x.direccao, nota.id, "16", "Erro de digitação do docente");
    const t = textoDe(await notasDoEstudante(x.userEst, x.est.id));
    expect(t).toContain("1600");
    expect(t).not.toContain(String(V_PUBLICADA));
  });

  it("reabrir uma pauta VALIDADA (ainda não publicada) mantém as notas invisíveis nos portais", async () => {
    const x = await montar();
    await reabrirPauta(x.direccao, x.turma.id, x.p2.id, "Faltava rever uma nota");
    expect((await notasDoEstudante(x.userEst, x.est.id))?.periodos).toEqual([]);
  });
});

describe("acesso cruzado e papéis", () => {
  it("estudante não vê o colega; encarregado não vê o colega nem de outro encarregado; ligação não verificada ou revogada → nada", async () => {
    const x = await prepararEstados(await montar());
    expect(await notasDoEstudante(x.userEst, x.colega.id)).toBeNull();
    expect(await notasDoEstudante(x.userEnc, x.colega.id)).toBeNull();
    const outroEnc = await c.principal("ENCARREGADO");
    await c.encarregado(outroEnc.id);
    expect(await notasDoEstudante(outroEnc, x.est.id)).toBeNull();
    await db.estudanteEncarregado.updateMany({
      where: { estudanteId: x.est.id },
      data: { verificado: false },
    });
    expect(await notasDoEstudante(x.userEnc, x.est.id)).toBeNull();
    await db.estudanteEncarregado.updateMany({
      where: { estudanteId: x.est.id },
      data: { verificado: true, autorizacaoActiva: false },
    });
    expect(await notasDoEstudante(x.userEnc, x.est.id)).toBeNull();
  });

  it("Direcção, Secretaria e Qualidade vêem todos os períodos (com o estado da pauta)", async () => {
    const x = await prepararEstados(await montar());
    for (const papel of ["DIRECCAO", "SECRETARIA", "QUALIDADE"] as const) {
      const u = await c.principal(papel);
      const r = await notasDoEstudante(u, x.est.id);
      expect(
        r?.periodos.map((p) => p.periodo),
        papel,
      ).toEqual(["1.º período", "2.º período", "3.º período"]);
      const estados = r!.periodos.flatMap((p) =>
        p.disciplinas.flatMap((d) => d.avaliacoes.map((a) => a.estadoPauta)),
      );
      expect(estados).toContain("PUBLICADA");
      expect(estados).toContain("VALIDADA");
      expect(estados).toContain("RASCUNHO");
    }
  });

  it("o Docente vê apenas as notas das disciplinas que lecciona; docente de fora da turma → nada", async () => {
    const x = await prepararEstados(await montar());
    const r = await notasDoEstudante(x.docente, x.est.id);
    const disciplinas = new Set(
      r!.periodos.flatMap((p) => p.disciplinas.map((d) => d.disciplinaId)),
    );
    expect(disciplinas).toEqual(new Set([x.tdMat.disciplinaId]));
    // vê também as suas notas não publicadas (é o autor), mas nunca as da colega de Português
    expect(textoDe(r)).toContain(String(V_RASCUNHO));
    expect(textoDe(r)).not.toContain(x.tdPort.disciplinaId);
    const estranho = await c.principal("DOCENTE");
    const fe = await c.funcionario(estranho.id);
    const turmaB = await c.turma(x.ano.id, (await c.classe()).id, "Z");
    await db.turmaDisciplina.create({
      data: { turmaId: turmaB.id, disciplinaId: (await c.disciplina()).id, docenteId: fe.id },
    });
    expect(await notasDoEstudante(estranho, x.est.id)).toBeNull();
  });

  it("Financeiro, Admin técnico e RH são recusados", async () => {
    const x = await prepararEstados(await montar());
    for (const papel of ["FINANCEIRO", "ADMIN_TECNICO", "RH"] as Papel[]) {
      const u = await c.principal(papel);
      await expect(notasDoEstudante(u, x.est.id), papel).rejects.toBeInstanceOf(ErroAutorizacao);
    }
  });

  it("identificadores inválidos ou inexistentes dão null (não rebentam, não revelam)", async () => {
    const x = await montar();
    const dir = await c.principal("DIRECCAO");
    await expect(notasDoEstudante(dir, "' OR 1=1 --")).rejects.toThrow();
    expect(await notasDoEstudante(dir, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await notasDoEstudante(x.userEst, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("pautas — leitura limitada ao escopo", () => {
  it("estudantes e encarregados não têm acesso às pautas (nem à lista nem ao detalhe)", async () => {
    const x = await prepararEstados(await montar());
    for (const u of [x.userEst, x.userEnc]) {
      expect(await listarPautas(u)).toEqual([]);
      expect(await obterPauta(u, x.turma.id, x.p1.id)).toBeNull();
    }
  });

  it("o Docente só vê as suas colunas na pauta e nunca a pauta de uma turma onde não lecciona", async () => {
    const x = await prepararEstados(await montar());
    const p = await obterPauta(x.docente, x.turma.id, x.p1.id);
    expect(p?.disciplinas.map((d) => d.id)).toEqual([x.tdMat.id]);
    expect(p?.avaliacoes.every((a) => a.turmaDisciplinaId === x.tdMat.id)).toBe(true);
    const estranho = await c.principal("DOCENTE");
    await c.funcionario(estranho.id);
    expect(await obterPauta(estranho, x.turma.id, x.p1.id)).toBeNull();
    expect((await listarPautas(estranho)).filter((q) => q.turmaId === x.turma.id)).toEqual([]);
  });

  it("a Direcção vê a pauta completa com médias e o estado; financeiro/admin recusados", async () => {
    const x = await prepararEstados(await montar());
    const p = await obterPauta(x.direccao, x.turma.id, x.p1.id);
    expect(p?.estado).toBe("PUBLICADA");
    expect(p?.disciplinas).toHaveLength(2);
    expect(p?.linhas).toHaveLength(2);
    expect(p?.linhas.find((l) => l.estudanteId === x.est.id)?.mediaGeral).toBe("12,3");
    for (const papel of ["FINANCEIRO", "ADMIN_TECNICO"] as Papel[]) {
      await expect(
        obterPauta(await c.principal(papel), x.turma.id, x.p1.id),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
    }
  });
});

describe("matriz de papéis de leitura de notas", () => {
  it("cada papel tem exactamente o acesso previsto na matriz (docs/security.md)", async () => {
    const x = await prepararEstados(await montar());
    const esperado: Record<Papel, "total" | "docente" | "portal-vazio" | "recusado"> = {
      DIRECCAO: "total",
      SECRETARIA: "total",
      QUALIDADE: "total",
      DOCENTE: "docente",
      ESTUDANTE: "portal-vazio", // sem ligação a este estudante
      ENCARREGADO: "portal-vazio",
      FINANCEIRO: "recusado",
      RH: "recusado",
      ADMIN_TECNICO: "recusado",
    };
    for (const papel of PAPEIS) {
      const u = await c.principal(papel);
      if (esperado[papel] === "recusado")
        await expect(notasDoEstudante(u, x.est.id), papel).rejects.toBeInstanceOf(ErroAutorizacao);
      else if (esperado[papel] === "total")
        expect((await notasDoEstudante(u, x.est.id))?.periodos.length, papel).toBe(3);
      else expect(await notasDoEstudante(u, x.est.id), papel).toBeNull();
    }
  });
});
