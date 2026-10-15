import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroAutorizacao } from "@/server/erros";
import { escopoEstudantes } from "@/server/authz/scope";
import { PAPEIS, type Papel } from "@/server/authz";
import {
  meusEducandos,
  obterEstudante,
  pesquisarEstudantes,
  verificarLigacao,
  definirAutorizacao,
} from "@/server/modules/pessoas";
import { comFalhaDeAuditoria, db, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

const ids = (l: { id: string }[]) => l.map((x) => x.id).sort();

describe("escopo — encarregado só vê educandos verificados E com autorização activa", () => {
  it("ligação NÃO verificada: o encarregado não vê nada (lista, pesquisa e acesso directo por ID)", async () => {
    const user = await c.principal("ENCARREGADO");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: false });
    expect(await meusEducandos(user)).toEqual([]);
    expect(await pesquisarEstudantes(user, "")).toEqual([]);
    expect(await obterEstudante(user, filho.id)).toBeNull();
  });

  it("verificada + activa: vê o educando; revogar a autorização retira o acesso de imediato", async () => {
    const user = await c.principal("ENCARREGADO");
    const sec = await c.principal("SECRETARIA");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: false });
    await verificarLigacao(sec, filho.id, enc.id);
    expect(ids(await meusEducandos(user))).toEqual([filho.id]);
    expect((await obterEstudante(user, filho.id))?.id).toBe(filho.id);
    await definirAutorizacao(sec, filho.id, enc.id, false);
    expect(await meusEducandos(user)).toEqual([]);
    expect(await obterEstudante(user, filho.id)).toBeNull();
    await definirAutorizacao(sec, filho.id, enc.id, true);
    expect(ids(await meusEducandos(user))).toEqual([filho.id]);
  });

  it("autorização activa mas NÃO verificada continua sem acesso (as duas condições são necessárias)", async () => {
    const user = await c.principal("ENCARREGADO");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: false, autorizacaoActiva: true });
    expect(await meusEducandos(user)).toEqual([]);
  });

  it("fora da validade (validoAte no passado ou validoDe no futuro) → sem acesso", async () => {
    const user = await c.principal("ENCARREGADO");
    const f1 = await c.estudante();
    const f2 = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(f1.id, enc.id, { verificado: true, validoAte: new Date("2020-01-01") });
    await c.ligar(f2.id, enc.id, { verificado: true, validoDe: new Date("2999-01-01") });
    expect(await meusEducandos(user)).toEqual([]);
  });

  it("acesso cruzado: um encarregado não vê o educando de outro (trocar o ID não ajuda)", async () => {
    const a = await c.principal("ENCARREGADO");
    const b = await c.principal("ENCARREGADO");
    const filhoA = await c.estudante();
    const filhoB = await c.estudante();
    const encA = await c.encarregado(a.id);
    const encB = await c.encarregado(b.id);
    await c.ligar(filhoA.id, encA.id, { verificado: true });
    await c.ligar(filhoB.id, encB.id, { verificado: true });
    expect(await obterEstudante(a, filhoB.id)).toBeNull();
    expect(await obterEstudante(b, filhoA.id)).toBeNull();
    expect(ids(await meusEducandos(a))).toEqual([filhoA.id]);
  });

  it("vários educandos (D8): vê só os verificados", async () => {
    const user = await c.principal("ENCARREGADO");
    const verificado = await c.estudante();
    const pendente = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(verificado.id, enc.id, { verificado: true });
    await c.ligar(pendente.id, enc.id, { verificado: false });
    expect(ids(await meusEducandos(user))).toEqual([verificado.id]);
  });

  it("conta de encarregado sem ficha de Encarregado associada não vê nada", async () => {
    const user = await c.principal("ENCARREGADO");
    await c.estudante();
    expect(await meusEducandos(user)).toEqual([]);
  });

  it("encarregado arquivado perde o acesso", async () => {
    const user = await c.principal("ENCARREGADO");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: true });
    await db.encarregado.update({ where: { id: enc.id }, data: { archivedAt: new Date() } });
    expect(await meusEducandos(user)).toEqual([]);
  });

  it("o encarregado não vê contactos nem BI de outros encarregados do mesmo educando", async () => {
    const user = await c.principal("ENCARREGADO");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: true });
    const ficha = await obterEstudante(user, filho.id);
    expect(ficha?.encarregados).toEqual([]);
    expect(ficha?.contacto).toBeNull();
  });
});

describe("validade da ligação — achado: depende do fuso horário do servidor", () => {
  const dia = (v: string) => new Date(`${v}T00:00:00.000Z`);
  async function vistoEm(agora: Date, validade: { validoAte?: Date; validoDe?: Date }) {
    const user = await c.principal("ENCARREGADO");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: true, ...validade });
    const r = await db.estudante.findMany({
      where: { AND: [escopoEstudantes(user, agora), { id: filho.id }] },
    });
    return r.length === 1;
  }

  it("validoAte = D: às 22:30Z de D ainda vale (em Luanda são 23:30 de D); às 23:30Z já expirou (em Luanda já é D+1)", async () => {
    expect(await vistoEm(new Date("2031-03-10T22:30:00Z"), { validoAte: dia("2031-03-10") })).toBe(
      true,
    );
    expect(await vistoEm(new Date("2031-03-10T23:30:00Z"), { validoAte: dia("2031-03-10") })).toBe(
      false,
    );
  });

  it("validoDe = D+1: às 23:30Z de D já começou (em Luanda já é D+1); às 22:30Z ainda não", async () => {
    expect(await vistoEm(new Date("2031-03-10T23:30:00Z"), { validoDe: dia("2031-03-11") })).toBe(
      true,
    );
    expect(await vistoEm(new Date("2031-03-10T22:30:00Z"), { validoDe: dia("2031-03-11") })).toBe(
      false,
    );
  });
});

describe("escopo — estudante, docente e gestão", () => {
  it("estudante vê só o próprio registo", async () => {
    const user = await c.principal("ESTUDANTE");
    const eu = await c.estudante({ userId: user.id });
    const outro = await c.estudante();
    expect(ids(await meusEducandos(user))).toEqual([eu.id]);
    expect(await obterEstudante(user, outro.id)).toBeNull();
    expect((await pesquisarEstudantes(user, "")).map((x) => x.id)).toEqual([eu.id]);
  });

  it("docente só vê estudantes com matrícula activa nas turmas onde lecciona", async () => {
    const doc = await c.principal("DOCENTE");
    const func = await c.funcionario(doc.id);
    const ano = await c.ano();
    const classe = await c.classe();
    const minha = await c.turma(ano.id, classe.id, "A");
    const outra = await c.turma(ano.id, classe.id, "B");
    const disc = await c.disciplina();
    await db.turmaDisciplina.create({
      data: { turmaId: minha.id, disciplinaId: disc.id, docenteId: func.id },
    });
    const meu = await c.estudante();
    const alheio = await c.estudante();
    const semMatricula = await c.estudante();
    await db.matricula.create({
      data: { estudanteId: meu.id, turmaId: minha.id, anoLectivoId: ano.id, tipo: "NOVA" },
    });
    await db.matricula.create({
      data: { estudanteId: alheio.id, turmaId: outra.id, anoLectivoId: ano.id, tipo: "NOVA" },
    });
    expect(ids(await meusEducandos(doc))).toEqual([meu.id]);
    expect(await obterEstudante(doc, alheio.id)).toBeNull();
    expect(await obterEstudante(doc, semMatricula.id)).toBeNull();
    // Se a matrícula for transferida para fora da sua turma, deixa de ver.
    await db.matricula.updateMany({
      where: { estudanteId: meu.id },
      data: { estado: "TRANSFERIDA" },
    });
    expect(await meusEducandos(doc)).toEqual([]);
  });

  it("Secretaria, Direcção, Financeiro e Qualidade vêem todos; Admin técnico, RH e sem papéis são recusados", async () => {
    const e = await c.estudante();
    for (const papel of ["SECRETARIA", "DIRECCAO", "FINANCEIRO", "QUALIDADE"] as Papel[]) {
      const u = await c.principal(papel);
      expect((await obterEstudante(u, e.id))?.id, papel).toBe(e.id);
    }
    for (const papeis of [["ADMIN_TECNICO"], ["RH"], []] as Papel[][]) {
      const u = await c.principal(...papeis);
      await expect(pesquisarEstudantes(u, ""), papeis.join()).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
      await expect(obterEstudante(u, e.id), papeis.join()).rejects.toBeInstanceOf(ErroAutorizacao);
    }
  });

  it("BI mascarado para quem não edita (Financeiro, Docente…) e completo para a Secretaria", async () => {
    const e = await c.estudante({ bi: `BI${Date.now()}XY123` });
    const sec = await c.principal("SECRETARIA");
    const fin = await c.principal("FINANCEIRO");
    expect((await obterEstudante(sec, e.id))?.bi).toBe(e.bi);
    const mascarado = (await obterEstudante(fin, e.id))?.bi ?? "";
    expect(mascarado).not.toBe(e.bi);
    expect(mascarado.endsWith(e.bi!.slice(-3))).toBe(true);
    expect(mascarado).toMatch(/^\*+/);
  });

  it("a pesquisa por termo continua limitada ao escopo", async () => {
    const user = await c.principal("ENCARREGADO");
    const filho = await c.estudante();
    const enc = await c.encarregado(user.id);
    await c.ligar(filho.id, enc.id, { verificado: true });
    const alheio = await c.estudante();
    expect(await pesquisarEstudantes(user, alheio.numeroProcesso)).toEqual([]);
    expect((await pesquisarEstudantes(user, filho.numeroProcesso)).map((x) => x.id)).toEqual([
      filho.id,
    ]);
  });

  it("identificador inválido devolve null (não rebenta nem revela)", async () => {
    const sec = await c.principal("SECRETARIA");
    expect(await obterEstudante(sec, "' OR 1=1 --")).toBeNull();
    expect(await obterEstudante(sec, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("papéis sem acesso a estudantes", () => {
  it("todos os papéis sem `estudantes:ver` são recusados", async () => {
    for (const papel of PAPEIS) {
      const u = await c.principal(papel);
      const pode = !["ADMIN_TECNICO", "RH"].includes(papel);
      if (pode) await expect(pesquisarEstudantes(u, "")).resolves.toBeDefined();
      else await expect(pesquisarEstudantes(u, "")).rejects.toBeInstanceOf(ErroAutorizacao);
    }
  });
});

describe("auditoria atómica — pessoas e ligações", () => {
  it("se a auditoria falhar, a verificação e a revogação NÃO ficam gravadas", async () => {
    const sec = await c.principal("SECRETARIA");
    const filho = await c.estudante();
    const enc = await c.encarregado();
    await c.ligar(filho.id, enc.id, { verificado: false });
    const ligacao = () =>
      db.estudanteEncarregado.findUniqueOrThrow({
        where: { estudanteId_encarregadoId: { estudanteId: filho.id, encarregadoId: enc.id } },
      });

    await comFalhaDeAuditoria("LIGACAO_VERIFICADA", () => verificarLigacao(sec, filho.id, enc.id));
    expect((await ligacao()).verificado).toBe(false);

    await verificarLigacao(sec, filho.id, enc.id);
    await comFalhaDeAuditoria("AUTORIZACAO_REVOGADA", () =>
      definirAutorizacao(sec, filho.id, enc.id, false),
    );
    expect((await ligacao()).autorizacaoActiva).toBe(true);
  });
});
