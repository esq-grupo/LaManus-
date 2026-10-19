import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Cenario } from "./cenario";
import { abrirSessao, corrigirComSessao, db, dbAdmin, prepararBd } from "./ajuda";
import { criarAvaliacao, lancarNotas } from "@/server/modules/avaliacao";
import { publicarPauta, validarPauta } from "@/server/modules/pautas";
import { notasDoEstudante } from "@/server/modules/notas-leitura";
import {
  confirmarPagamento,
  extractoDoEstudante,
  registarPagamento,
} from "@/server/modules/financeiro";
import {
  contarNaoLidos,
  listarAvisos,
  marcarLido,
  marcarTodosLidos,
  notificarPautaPublicada,
} from "@/server/modules/notificacoes";
import { ErroAutorizacao } from "@/server/erros";
import { escopoPortal } from "@/server/authz/scope";
import { contemValor } from "../valores";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

const NOTA = 1777; // marcador: nunca pode aparecer num aviso

/** Turma com um estudante (conta própria), 1 encarregado verificado, 1 por verificar, 1 com autorização revogada, 1 com validade expirada. */
async function cena() {
  const docente = await c.principal("DOCENTE");
  const func = await c.funcionario(docente.id);
  const direccao = await c.principal("DIRECCAO");
  const ano = await c.ano();
  const [p1] = await c.periodosDoAno(ano);
  const classe = await c.classe();
  const turma = await c.turma(ano.id, classe.id);
  const disc = await c.disciplina();
  const td = await db.turmaDisciplina.create({
    data: { turmaId: turma.id, disciplinaId: disc.id, docenteId: func.id },
  });
  const userEst = await c.principal("ESTUDANTE");
  const est = await c.estudante({ userId: userEst.id });
  const outroEst = await c.estudante();
  await c.matricular(est.id, turma.id, ano.id);
  await c.matricular(outroEst.id, turma.id, ano.id);
  const mk = async (extra: Parameters<typeof c.ligar>[2]) => {
    const u = await c.principal("ENCARREGADO");
    const e = await c.encarregado(u.id);
    await c.ligar(est.id, e.id, extra);
    return u;
  };
  const encOk = await mk({ verificado: true, autorizacaoActiva: true });
  const encNaoVerif = await mk({ verificado: false, autorizacaoActiva: true });
  const encRevogado = await mk({ verificado: true, autorizacaoActiva: false });
  const encExpirado = await mk({
    verificado: true,
    autorizacaoActiva: true,
    validoAte: new Date("2020-01-01"),
  });
  const dia = new Date(p1.inicio.getTime() + 5 * 864e5).toISOString().slice(0, 10);
  const a = await criarAvaliacao(docente, {
    turmaDisciplinaId: td.id,
    periodoId: p1.id,
    tipo: "TESTE",
    nome: "Teste 1",
    peso: 100,
    data: dia,
  });
  await lancarNotas(docente, a, [
    { estudanteId: est.id, valor: "17,77" },
    { estudanteId: outroEst.id, valor: "9" },
  ]);
  await validarPauta(direccao, turma.id, p1.id);
  return {
    docente,
    direccao,
    ano,
    p1,
    turma,
    userEst,
    est,
    outroEst,
    encOk,
    encNaoVerif,
    encRevogado,
    encExpirado,
  };
}

describe("avisos — quem recebe e o que dizem", () => {
  it("publicar a pauta avisa o estudante e o encarregado verificado/activo/na validade — e mais ninguém", async () => {
    const x = await cena();
    const outroUser = await c.principal("ESTUDANTE");
    await c.estudante({ userId: outroUser.id }); // estudante sem matrícula na turma
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    expect(await listarAvisos(x.userEst)).toHaveLength(1);
    expect(await listarAvisos(x.encOk)).toHaveLength(1);
    for (const u of [
      x.encNaoVerif,
      x.encRevogado,
      x.encExpirado,
      outroUser,
      x.docente,
      x.direccao,
    ]) {
      expect(await listarAvisos(u), u.papeis.join()).toHaveLength(0);
    }
    // a própria geração não cria linhas para quem não tem acesso (não basta o filtro de leitura esconder)
    for (const u of [
      x.encNaoVerif,
      x.encRevogado,
      x.encExpirado,
      outroUser,
      x.docente,
      x.direccao,
    ]) {
      expect(await db.notificacao.count({ where: { userId: u.id } }), u.papeis.join()).toBe(0);
    }
    const [aviso] = await listarAvisos(x.userEst);
    expect(aviso!.tipo).toBe("PAUTA_PUBLICADA");
    expect(contemValor(JSON.stringify(aviso), NOTA)).toBe(false);
    expect(JSON.stringify(aviso)).not.toMatch(/\d{2},\d/); // nenhuma nota formatada
  });

  it("é idempotente: repetir a geração não duplica", async () => {
    const x = await cena();
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    await notificarPautaPublicada(db, x.turma.id, x.p1.id);
    await notificarPautaPublicada(db, x.turma.id, x.p1.id);
    expect(await listarAvisos(x.userEst)).toHaveLength(1);
  });

  it("se a publicação falha, não fica aviso nenhum (mesma transacção)", async () => {
    const x = await cena();
    await expect(publicarPauta(x.docente, x.turma.id, x.p1.id)).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    expect(await listarAvisos(x.userEst)).toHaveLength(0);
  });

  it("correcção de nota e recibo emitido geram os seus avisos", async () => {
    const x = await cena();
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    const nota = await db.nota.findFirstOrThrow({ where: { estudanteId: x.est.id } });
    await corrigirComSessao(x.direccao, nota.id, "16", "Erro de digitação do docente");
    const fin = await c.principal("FINANCEIRO");
    const pag = await registarPagamento(
      fin,
      {
        estudanteId: x.est.id,
        valorKz: 100,
        metodo: "TPA",
        dataPagamento: new Date().toISOString().slice(0, 10),
      },
      { tokenSessao: await abrirSessao(fin.email) },
    );
    await confirmarPagamento(x.direccao, pag, { tokenSessao: await abrirSessao(x.direccao.email) });
    const tipos = (await listarAvisos(x.userEst)).map((a) => a.tipo).sort();
    expect(tipos).toEqual(["NOTA_CORRIGIDA", "PAUTA_PUBLICADA", "RECIBO_EMITIDO"]);
    expect((await listarAvisos(x.encOk)).map((a) => a.tipo).sort()).toEqual(tipos);
  });
});

describe("avisos — só o destinatário lê e marca", () => {
  it("outro utilizador não vê nem marca os meus avisos (mesmo sabendo o id)", async () => {
    const x = await cena();
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    const [aviso] = await listarAvisos(x.userEst);
    expect(await marcarLido(x.encOk, aviso!.id)).toBe(0);
    expect(await marcarLido(x.docente, aviso!.id)).toBe(0);
    expect(await contarNaoLidos(x.userEst)).toBe(1);
    expect(await marcarLido(x.userEst, aviso!.id)).toBe(1);
    expect(await contarNaoLidos(x.userEst)).toBe(0);
    expect(await contarNaoLidos(x.encOk)).toBe(1); // o do encarregado é outro aviso
    expect(await marcarTodosLidos(x.encOk)).toBe(1);
  });

  it("revogar a ligação esconde os avisos desse educando; o texto de um aviso não se altera", async () => {
    const x = await cena();
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    expect(await listarAvisos(x.encOk)).toHaveLength(1);
    await dbAdmin.estudanteEncarregado.updateMany({
      where: { estudanteId: x.est.id, encarregado: { userId: x.encOk.id } },
      data: { autorizacaoActiva: false },
    });
    expect(await listarAvisos(x.encOk)).toHaveLength(0);
    expect(await contarNaoLidos(x.encOk)).toBe(0);
    const [aviso] = await listarAvisos(x.userEst);
    expect(
      await db.notificacao
        .updateMany({ where: { id: aviso!.id }, data: { corpo: "Nota 17,77" } })
        .then(
          () => "ok",
          () => "erro",
        ),
    ).toBe("erro");
    await marcarLido(x.userEst, aviso!.id);
    expect(
      await dbAdmin.notificacao
        .updateMany({ where: { id: aviso!.id }, data: { lidaEm: null } })
        .then(
          () => "ok",
          () => "erro",
        ),
    ).toBe("erro");
  });
});

describe("portais — acesso cruzado (alterar o id no pedido)", () => {
  it("estudante e encarregados só chegam aos seus: notas, contas e recibo de outro estudante são recusados", async () => {
    const x = await cena();
    await publicarPauta(x.direccao, x.turma.id, x.p1.id);
    // o estudante vê as suas notas; as do colega não
    expect((await notasDoEstudante(x.userEst, x.est.id))?.periodos.length).toBe(1);
    expect(await notasDoEstudante(x.userEst, x.outroEst.id)).toBeNull();
    await expect(extractoDoEstudante(x.userEst, x.outroEst.id)).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    // encarregado verificado vê o educando; os outros quatro tipos de ligação, não
    expect((await notasDoEstudante(x.encOk, x.est.id))?.periodos.length).toBe(1);
    await expect(extractoDoEstudante(x.encOk, x.outroEst.id)).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    for (const u of [x.encNaoVerif, x.encRevogado, x.encExpirado]) {
      expect(await notasDoEstudante(u, x.est.id)).toBeNull();
      await expect(extractoDoEstudante(u, x.est.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    }
  });

  it("escopoPortal: Docente+Encarregado não ganha os alunos que ensina; sem papéis de portal → nada", async () => {
    const x = await cena();
    const misto = await c.principal("DOCENTE", "ENCARREGADO");
    const func = await c.funcionario(misto.id);
    const d2 = await c.disciplina();
    await db.turmaDisciplina.create({
      data: { turmaId: x.turma.id, disciplinaId: d2.id, docenteId: func.id },
    });
    expect(await db.estudante.count({ where: { id: x.est.id, ...escopoPortal(misto) } })).toBe(0);
    expect(await db.estudante.count({ where: { id: x.est.id, ...escopoPortal(x.docente) } })).toBe(
      0,
    );
    expect(await db.estudante.count({ where: { id: x.est.id, ...escopoPortal(x.direccao) } })).toBe(
      0,
    );
    expect(await db.estudante.count({ where: { id: x.est.id, ...escopoPortal(x.userEst) } })).toBe(
      1,
    );
    expect(await db.estudante.count({ where: { id: x.est.id, ...escopoPortal(x.encOk) } })).toBe(1);
  });
});
