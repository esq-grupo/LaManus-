import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Cenario } from "./cenario";
import { db, dbAdmin, prepararBd } from "./ajuda";
import {
  cancelarPedido,
  decidirPedido,
  emitirDeclaracao,
  filaDePedidos,
  obterDocumento,
  pedidosDoPortal,
  pedirDeclaracao,
} from "@/server/modules/declaracoes";
import { gerarDeclaracaoPdf } from "@/server/modules/declaracao-pdf";
import { listarAvisos } from "@/server/modules/notificacoes";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { PAPEIS, type Papel } from "@/server/authz";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(async () => {
  const ests = { in: c.estudantes };
  await dbAdmin.declaracaoEmitida.deleteMany({ where: { pedido: { estudanteId: ests } } });
  await dbAdmin.pedidoDeclaracao.deleteMany({ where: { estudanteId: ests } });
  await c.limpar();
});

async function cena() {
  const ano = await c.ano();
  const classe = await c.classe();
  const turma = await c.turma(ano.id, classe.id);
  const userEst = await c.principal("ESTUDANTE");
  const est = await c.estudante({ userId: userEst.id });
  await c.matricular(est.id, turma.id, ano.id);
  const userEnc = await c.principal("ENCARREGADO");
  const enc = await c.encarregado(userEnc.id);
  await c.ligar(est.id, enc.id, { verificado: true, autorizacaoActiva: true });
  const secretaria = await c.principal("SECRETARIA");
  const direccao = await c.principal("DIRECCAO");
  return { ano, turma, userEst, est, userEnc, secretaria, direccao };
}
type Cena = Awaited<ReturnType<typeof cena>>;

async function emitida(x: Cena, tipo = "MATRICULA", quem = x.userEst) {
  const p = await pedirDeclaracao(quem, {
    estudanteId: x.est.id,
    tipo,
    finalidade: "Para a embaixada",
  });
  await decidirPedido(x.direccao, p.id, "APROVAR", undefined);
  const doc = await emitirDeclaracao(x.secretaria, p.id);
  return { p, doc };
}

describe("declarações — fluxo completo", () => {
  it("estudante pede → Direcção aprova → Secretaria emite → PDF; avisos ao requerente; auditoria", async () => {
    const x = await cena();
    const p = await pedirDeclaracao(x.userEst, {
      estudanteId: x.est.id,
      tipo: "MATRICULA",
      finalidade: "Para a embaixada",
    });
    expect(p.estado).toBe("PEDIDO");
    await expect(
      pedirDeclaracao(x.userEst, {
        estudanteId: x.est.id,
        tipo: "MATRICULA",
        finalidade: "Outra vez",
      }),
    ).rejects.toBeInstanceOf(ErroValidacao);
    expect((await filaDePedidos(x.direccao)).map((f) => f.id)).toContain(p.id);
    expect((await filaDePedidos(x.secretaria)).map((f) => f.id)).not.toContain(p.id);
    await decidirPedido(x.direccao, p.id, "APROVAR", undefined);
    expect((await filaDePedidos(x.secretaria)).map((f) => f.id)).toContain(p.id);
    const doc = await emitirDeclaracao(x.secretaria, p.id);
    const { documento, dados } = await obterDocumento(x.userEst, p.id);
    expect(documento.id).toBe(doc.id);
    expect(dados.nome).toBe("Estudante de Teste");
    const pdf = await gerarDeclaracaoPdf({ ...documento, dados });
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    const tipos = (await listarAvisos(x.userEst)).map((a) => a.tipo).sort();
    expect(tipos).toEqual(["DECLARACAO_EMITIDA", "PEDIDO_APROVADO"]);
    const acoes = (
      await db.eventoAuditoria.findMany({ where: { entidadeId: p.id }, select: { acao: true } })
    )
      .map((e) => e.acao)
      .sort();
    expect(acoes).toEqual([
      "DECLARACAO_APROVADA",
      "DECLARACAO_DESCARREGADA",
      "DECLARACAO_EMITIDA",
      "DECLARACAO_PEDIDA",
    ]);
  });

  it("rejeição exige motivo e avisa; cancelamento só pelo requerente e só antes de decidir", async () => {
    const x = await cena();
    const p = await pedirDeclaracao(x.userEnc, {
      estudanteId: x.est.id,
      tipo: "FREQUENCIA",
      finalidade: "Para o banco",
    });
    await expect(decidirPedido(x.direccao, p.id, "REJEITAR", "x")).rejects.toBeInstanceOf(
      ErroValidacao,
    );
    await decidirPedido(x.direccao, p.id, "REJEITAR", "Dados incompletos");
    expect((await listarAvisos(x.userEnc)).map((a) => a.tipo)).toEqual(["PEDIDO_REJEITADO"]);
    await expect(emitirDeclaracao(x.secretaria, p.id)).rejects.toBeInstanceOf(ErroValidacao);
    const p2 = await pedirDeclaracao(x.userEnc, {
      estudanteId: x.est.id,
      tipo: "FREQUENCIA",
      finalidade: "Para o banco",
    });
    await expect(cancelarPedido(x.userEst, p2.id)).rejects.toBeInstanceOf(ErroAutorizacao); // outra pessoa
    await cancelarPedido(x.userEnc, p2.id);
    await expect(decidirPedido(x.direccao, p2.id, "APROVAR", undefined)).rejects.toBeInstanceOf(
      ErroValidacao,
    );
    await expect(cancelarPedido(x.userEnc, p2.id)).rejects.toBeInstanceOf(ErroValidacao);
  });

  it("números de documento consecutivos e distintos com emissões em simultâneo", async () => {
    const x = await cena();
    const tipos = ["MATRICULA", "FREQUENCIA"] as const;
    const est2 = await c.estudante();
    await c.matricular(est2.id, x.turma.id, x.ano.id);
    const ids: string[] = [];
    for (const [e, t] of [
      [x.est, tipos[0]],
      [x.est, tipos[1]],
      [est2, tipos[0]],
      [est2, tipos[1]],
    ] as const) {
      const p = await pedirDeclaracao(x.secretaria, {
        estudanteId: e.id,
        tipo: t,
        finalidade: "Pedido na secretaria",
      });
      await decidirPedido(x.direccao, p.id, "APROVAR", undefined);
      ids.push(p.id);
    }
    const sec2 = await c.principal("SECRETARIA");
    const rs = await Promise.allSettled(
      ids.map((id, i) => emitirDeclaracao(i % 2 ? sec2 : x.secretaria, id)),
    );
    expect(rs.every((r) => r.status === "fulfilled")).toBe(true);
    const nums = (
      await db.declaracaoEmitida.findMany({
        where: { pedidoId: { in: ids } },
        orderBy: { numero: "asc" },
      })
    ).map((d) => d.numero);
    expect(new Set(nums).size).toBe(4);
    expect(nums[3]! - nums[0]!).toBe(3);
  });
});

describe("declarações — permissões e controlo duplo", () => {
  for (const papel of PAPEIS) {
    it(`${papel}: pedir/aprovar/emitir conforme a matriz`, async () => {
      const x = await cena();
      const u = await c.principal(papel);
      const pedeEmNomeProprio = papel === "SECRETARIA";
      // pedir por um estudante que não é seu: só a Secretaria
      const r = pedirDeclaracao(u, {
        estudanteId: x.est.id,
        tipo: "MATRICULA",
        finalidade: "Teste de permissões",
      });
      if (pedeEmNomeProprio) await expect(r).resolves.toBeTruthy();
      else await expect(r).rejects.toBeInstanceOf(ErroAutorizacao);
      const p = await pedirDeclaracao(x.userEst, {
        estudanteId: x.est.id,
        tipo: "FREQUENCIA",
        finalidade: "Teste de permissões",
      });
      const d = decidirPedido(u, p.id, "APROVAR", undefined);
      if (papel === "DIRECCAO") await expect(d).resolves.toBeUndefined();
      else await expect(d).rejects.toBeInstanceOf(ErroAutorizacao);
      const e = emitirDeclaracao(u, p.id);
      if (papel === "SECRETARIA")
        await expect(e).rejects.toBeInstanceOf(ErroValidacao); // não aprovado (a aprovação foi só neste teste para a Direcção)
      else await expect(e).rejects.toThrow();
    });
  }

  it("quem aprova não emite (mesmo com os dois papéis) e quem pede não decide o próprio pedido", async () => {
    const x = await cena();
    const ambos = await c.principal("DIRECCAO", "SECRETARIA");
    const p = await pedirDeclaracao(x.userEst, {
      estudanteId: x.est.id,
      tipo: "MATRICULA",
      finalidade: "Para a embaixada",
    });
    await decidirPedido(ambos, p.id, "APROVAR", undefined);
    await expect(emitirDeclaracao(ambos, p.id)).rejects.toThrow(/aprovou/);
    expect((await db.pedidoDeclaracao.findUnique({ where: { id: p.id } }))?.estado).toBe(
      "APROVADO",
    );
    await emitirDeclaracao(x.secretaria, p.id); // outra pessoa emite
    // pediu como Secretaria (com o papel Direcção também) → não decide o seu pedido
    const meu = await pedirDeclaracao(ambos, {
      estudanteId: x.est.id,
      tipo: "FREQUENCIA",
      finalidade: "Pedido na secretaria",
    });
    await expect(decidirPedido(ambos, meu.id, "APROVAR", undefined)).rejects.toThrow(/por si/);
  });

  it("acesso cruzado: encarregado de outro estudante, por verificar, estudante alheio — não pedem nem descarregam", async () => {
    const x = await cena();
    const alheio = await c.estudante();
    await c.matricular(alheio.id, x.turma.id, x.ano.id);
    const naoVerif = await c.principal("ENCARREGADO");
    const eNv = await c.encarregado(naoVerif.id);
    await c.ligar(x.est.id, eNv.id, { verificado: false, autorizacaoActiva: true });
    for (const u of [x.userEnc, naoVerif, x.userEst]) {
      await expect(
        pedirDeclaracao(u, { estudanteId: alheio.id, tipo: "MATRICULA", finalidade: "Tentativa" }),
      ).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    await expect(
      pedirDeclaracao(naoVerif, {
        estudanteId: x.est.id,
        tipo: "MATRICULA",
        finalidade: "Tentativa",
      }),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    const { p } = await emitida(x);
    const docente = await c.principal("DOCENTE");
    const financeiro = await c.principal("FINANCEIRO");
    for (const u of [naoVerif, docente, financeiro])
      await expect(obterDocumento(u, p.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(obterDocumento(x.userEnc, p.id)).resolves.toBeTruthy(); // encarregado verificado
    await expect(obterDocumento(x.secretaria, p.id)).resolves.toBeTruthy();
    await expect(obterDocumento(x.userEst, "nao-e-um-id")).rejects.toBeInstanceOf(ErroAutorizacao);
    // o portal só lista pedidos dos seus educandos
    expect((await pedidosDoPortal(naoVerif)).length).toBe(0);
    expect((await pedidosDoPortal(x.userEnc)).map((q) => q.id)).toContain(p.id);
  });

  it("um pedido ainda não emitido não se descarrega", async () => {
    const x = await cena();
    const p = await pedirDeclaracao(x.userEst, {
      estudanteId: x.est.id,
      tipo: "MATRICULA",
      finalidade: "Para a embaixada",
    });
    await expect(obterDocumento(x.userEst, p.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    await decidirPedido(x.direccao, p.id, "APROVAR", undefined);
    await expect(obterDocumento(x.secretaria, p.id)).rejects.toBeInstanceOf(ErroAutorizacao);
  });
});

describe("declarações — dados validados na emissão", () => {
  it("matrícula anulada depois da aprovação impede a emissão", async () => {
    const x = await cena();
    const p = await pedirDeclaracao(x.userEst, {
      estudanteId: x.est.id,
      tipo: "MATRICULA",
      finalidade: "Para a embaixada",
    });
    await decidirPedido(x.direccao, p.id, "APROVAR", undefined);
    await dbAdmin.matricula.updateMany({
      where: { estudanteId: x.est.id },
      data: { estado: "ANULADA" },
    });
    await expect(emitirDeclaracao(x.secretaria, p.id)).rejects.toThrow(/matrícula activa/);
  });

  it("situação financeira: bloqueada com valores em atraso; permitida com encargos ainda por vencer; pedir sem matrícula activa é recusado", async () => {
    const x = await cena();
    const tipo = await c.tipoEncargo();
    const enc = (venc: string, ref: string) =>
      db.encargo.create({
        data: {
          estudanteId: x.est.id,
          tipoEncargoId: tipo.id,
          anoLectivoId: x.ano.id,
          referencia: ref,
          descricao: ref,
          valor: 100_00n,
          vencimento: new Date(venc),
        },
      });
    await enc("2020-01-05", "atrasado");
    const p = await pedirDeclaracao(x.userEst, {
      estudanteId: x.est.id,
      tipo: "SITUACAO_FINANCEIRA",
      finalidade: "Para o banco",
    });
    await decidirPedido(x.direccao, p.id, "APROVAR", undefined);
    await expect(emitirDeclaracao(x.secretaria, p.id)).rejects.toThrow(/em atraso/);
    // anular o encargo em atraso e criar só um ainda por vencer → já se emite
    await db.encargo.updateMany({
      where: { estudanteId: x.est.id, referencia: "atrasado" },
      data: {
        anuladoEm: new Date(),
        anuladoPorId: x.direccao.id,
        motivoAnulacao: "Lançado por engano",
      },
    });
    await enc("2099-01-05", "futuro");
    await expect(emitirDeclaracao(x.secretaria, p.id)).resolves.toBeTruthy();
    const sem = await c.estudante({});
    await expect(
      pedirDeclaracao(x.secretaria, {
        estudanteId: sem.id,
        tipo: "MATRICULA",
        finalidade: "Sem matrícula",
      }),
    ).rejects.toThrow(/matrícula activa/);
  });

  it("o documento é um instantâneo: mudar o nome do estudante depois não altera o emitido", async () => {
    const x = await cena();
    const { p } = await emitida(x);
    await dbAdmin.estudante.update({
      where: { id: x.est.id },
      data: { nome: "Nome Alterado Depois" },
    });
    expect((await obterDocumento(x.userEst, p.id)).dados.nome).toBe("Estudante de Teste");
  });
});

describe("declarações — a base de dados impõe o fluxo", () => {
  it("saltar estados, emitir sem documento, reabrir estados finais, apagar e alterar o documento são recusados", async () => {
    const x = await cena();
    const p = await pedirDeclaracao(x.userEst, {
      estudanteId: x.est.id,
      tipo: "MATRICULA",
      finalidade: "Para a embaixada",
    });
    const tenta = (data: Record<string, unknown>) =>
      db.pedidoDeclaracao.updateMany({ where: { id: p.id }, data }).then(
        () => "ok",
        () => "erro",
      );
    expect(
      await tenta({
        estado: "EMITIDA",
        decididoPorId: x.direccao.id,
        decididoEm: new Date(),
        emitidoPorId: x.secretaria.id,
        emitidoEm: new Date(),
      }),
    ).toBe("erro");
    expect(await tenta({ estado: "APROVADO" })).toBe("erro"); // sem decisor
    expect(await tenta({ finalidade: "Alterada" })).toBe("erro");
    expect(
      await db.pedidoDeclaracao.deleteMany({ where: { id: p.id } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    await expect(db.$executeRawUnsafe(`TRUNCATE "PedidoDeclaracao" CASCADE`)).rejects.toThrow();
    // aprovado a si próprio: a restrição recusa
    expect(
      await tenta({ estado: "APROVADO", decididoPorId: x.userEst.id, decididoEm: new Date() }),
    ).toBe("erro");
    const { p: emit, doc } = await emitida(x, "FREQUENCIA");
    expect(
      await db.pedidoDeclaracao
        .updateMany({ where: { id: emit.id }, data: { estado: "PEDIDO" } })
        .then(
          () => "ok",
          () => "erro",
        ),
    ).toBe("erro");
    expect(
      await db.declaracaoEmitida.updateMany({ where: { id: doc.id }, data: { dados: {} } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    expect(
      await db.declaracaoEmitida.deleteMany({ where: { id: doc.id } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    expect(
      await dbAdmin.declaracaoEmitida
        .updateMany({ where: { id: doc.id }, data: { codigo: "X".repeat(16) } })
        .then(
          () => "ok",
          () => "erro",
        ),
    ).toBe("erro");
  });
});
