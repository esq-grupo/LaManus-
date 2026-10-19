import { afterAll, describe, expect, it } from "vitest";
import { Cenario } from "./cenario";
import { abrirSessao, comFalhaDeAuditoria, db, dbAdmin } from "./ajuda";

// Garantias do livro de movimentos na BASE DE DADOS (ADR-0004): a aplicação (`db`, papel restrito) não escreve
// directamente nas tabelas de movimentos; só chega a CONFIRMADO / alocações / recibos / estornos pelos procedimentos
// autorizados, que autenticam o autor pelo token da sessão.
const c = new Cenario();
afterAll(() => c.limpar());

const dia = "2026-10-01";

async function registar(token: string, est: string, valor: bigint, modo = "AUTOMATICO") {
  const r = await db.$queryRaw<{ id: string }[]>`
    SELECT registar_pagamento(${est}::uuid, ${valor}::bigint, 'TRANSFERENCIA'::"MetodoPagamento", ${dia}::date,
      ${modo}::"ModoAlocacao", 'REF-1', 'Pagador', ${token}, '127.0.0.1') AS id`;
  return r[0]!.id;
}
async function confirmar(token: string, pag: string) {
  const r = await db.$queryRaw<
    { id: string }[]
  >`SELECT confirmar_pagamento(${pag}::uuid, ${token}, '127.0.0.1') AS id`;
  return r[0]!.id;
}
async function propor(token: string, pag: string, valor: bigint, motivo = "Pagamento duplicado") {
  const r = await db.$queryRaw<{ id: string }[]>`
    SELECT propor_estorno(${pag}::uuid, ${valor}::bigint, ${motivo}, ${token}, '127.0.0.1') AS id`;
  return r[0]!.id;
}
async function aprovar(token: string, est: string) {
  await db.$executeRaw`SELECT aprovar_estorno(${est}::uuid, 'ok', ${token}, '127.0.0.1')`;
}
async function encargo(
  estudanteId: string,
  tipoEncargoId: string,
  anoLectivoId: string,
  ref: string,
  valor: bigint,
  venc: string,
) {
  return db.encargo.create({
    data: {
      estudanteId,
      tipoEncargoId,
      anoLectivoId,
      referencia: ref,
      descricao: `Propina ${ref}`,
      valor,
      vencimento: new Date(venc),
    },
  });
}
async function pessoas() {
  const fin = await c.principal("FINANCEIRO");
  const dir = await c.principal("DIRECCAO");
  const dir2 = await c.principal("DIRECCAO");
  return {
    fin,
    dir,
    dir2,
    tFin: await abrirSessao(fin.email),
    tDir: await abrirSessao(dir.email),
    tDir2: await abrirSessao(dir2.email),
  };
}
async function base() {
  const ano = await c.ano();
  const tipo = await c.tipoEncargo();
  const est = await c.estudante();
  return { ano, tipo, est };
}
async function reconc(estId: string) {
  return db.$queryRaw<
    { verificacao: string }[]
  >`SELECT * FROM reconciliacao_financeira(ARRAY[${estId}::uuid])`;
}

describe("financeiro — a aplicação não escreve no livro de movimentos", () => {
  it("INSERT/UPDATE/DELETE/TRUNCATE directos em Pagamento, Alocação, Estorno, Recibo e Série são recusados", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const enc = await encargo(est.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const pag = await registar(p.tFin, est.id, 100_00n);
    await expect(
      db.pagamento.create({
        data: {
          estudanteId: est.id,
          valor: 1n,
          metodo: "TPA",
          dataPagamento: new Date(dia),
          registadoPorId: p.fin.id,
        },
      }),
    ).rejects.toThrow();
    expect(
      await db.pagamento.updateMany({ where: { id: pag }, data: { valor: 1n } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    expect(
      await db.pagamento.updateMany({ where: { id: pag }, data: { estado: "CONFIRMADO" } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    expect(
      await db.pagamento.deleteMany({ where: { id: pag } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    await expect(db.$executeRawUnsafe(`TRUNCATE "Pagamento" CASCADE`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`TRUNCATE "AlocacaoPagamento"`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`TRUNCATE "Recibo"`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`TRUNCATE "SerieRecibo"`)).rejects.toThrow();
    await expect(
      db.alocacaoPagamento.create({
        data: { pagamentoId: pag, encargoId: enc.id, estudanteId: est.id, valor: 100_00n },
      }),
    ).rejects.toThrow();
    await expect(
      db.recibo.create({
        data: {
          serie: "R",
          ano: 2026,
          numero: 999999,
          pagamentoId: pag,
          estudanteId: est.id,
          valor: 100_00n,
          emitidoPorId: p.fin.id,
        },
      }),
    ).rejects.toThrow();
    await expect(db.serieRecibo.updateMany({ data: { proximo: 1 } })).rejects.toThrow();
    const depois = await db.pagamento.findUnique({ where: { id: pag } });
    expect(depois?.estado).toBe("REGISTADO");
    expect(depois?.valor).toBe(100_00n);
  });

  it("mesmo o DONO das tabelas não altera o valor nem salta estados (gatilhos)", async () => {
    const p = await pessoas();
    const { est } = await base();
    const pag = await registar(p.tFin, est.id, 100_00n);
    await expect(
      dbAdmin.$executeRaw`UPDATE "Pagamento" SET valor = 1 WHERE id = ${pag}::uuid`,
    ).rejects.toThrow();
    await expect(
      dbAdmin.$executeRaw`UPDATE "Pagamento" SET estado = 'ESTORNADO' WHERE id = ${pag}::uuid`,
    ).rejects.toThrow();
    await confirmar(p.tDir, pag);
    await expect(
      dbAdmin.$executeRaw`UPDATE "Pagamento" SET valor = 1 WHERE id = ${pag}::uuid`,
    ).rejects.toThrow();
    await expect(
      dbAdmin.$executeRaw`UPDATE "Pagamento" SET estado = 'REGISTADO', "confirmadoEm" = NULL, "confirmadoPorId" = NULL WHERE id = ${pag}::uuid`,
    ).rejects.toThrow();
    await expect(
      dbAdmin.$executeRaw`UPDATE "Recibo" SET valor = 1 WHERE "pagamentoId" = ${pag}::uuid`,
    ).rejects.toThrow();
  });

  it("encargo: valor imutável; anular só sem pagamentos líquidos; nunca se apaga", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const e1 = await encargo(est.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const e2 = await encargo(est.id, tipo.id, ano.id, "2026-11", 100_00n, "2026-11-05");
    expect(
      await db.encargo.updateMany({ where: { id: e1.id }, data: { valor: 1n } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    expect(
      await db.encargo.deleteMany({ where: { id: e1.id } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    await confirmar(p.tDir, await registar(p.tFin, est.id, 100_00n));
    const anular = (id: string) =>
      db.encargo
        .updateMany({
          where: { id },
          data: {
            anuladoEm: new Date(),
            anuladoPorId: p.dir.id,
            motivoAnulacao: "Lançado por engano",
          },
        })
        .then(
          () => "ok",
          () => "erro",
        );
    expect(await anular(e1.id)).toBe("erro"); // tem 100,00 alocados
    expect(await anular(e2.id)).toBe("ok");
    expect((await db.encargo.findUnique({ where: { id: e2.id } }))?.anuladoEm).not.toBeNull();
    expect(
      await db.encargo
        .updateMany({
          where: { id: e2.id },
          data: { anuladoEm: null, anuladoPorId: null, motivoAnulacao: null },
        })
        .then(
          () => "ok",
          () => "erro",
        ),
    ).toBe("erro");
  });
});

describe("financeiro — procedimentos autenticam o autor pela sessão", () => {
  it("token inválido, hash do token, sessão expirada/revogada e permissão em falta são recusados", async () => {
    const p = await pessoas();
    const { est } = await base();
    await expect(registar("x".repeat(30), est.id, 1_00n)).rejects.toThrow();
    await expect(registar(p.tDir, est.id, 1_00n)).rejects.toThrow(); // Direcção não tem financeiro:editar
    const pag = await registar(p.tFin, est.id, 100_00n);
    await expect(confirmar(p.tFin, pag)).rejects.toThrow(); // Financeiro não tem pagamento:confirmar
    const hash = (await dbAdmin.session.findFirst({ where: { userId: p.dir.id } }))!.tokenHash;
    await expect(confirmar(hash, pag)).rejects.toThrow();
    await dbAdmin.session.updateMany({
      where: { userId: p.dir.id },
      data: { ultimaActividade: new Date(Date.now() - 31 * 60_000) },
    });
    await expect(confirmar(p.tDir, pag)).rejects.toThrow();
    await dbAdmin.session.updateMany({
      where: { userId: p.dir.id },
      data: { ultimaActividade: new Date(), revogadaEm: new Date() },
    });
    await expect(confirmar(p.tDir, pag)).rejects.toThrow();
    expect((await db.pagamento.findUnique({ where: { id: pag } }))?.estado).toBe("REGISTADO");
  });

  it("quem registou não confirma (mesmo com os dois papéis); outra pessoa da Direcção confirma", async () => {
    const p = await pessoas();
    const ambos = await c.principal("FINANCEIRO", "DIRECCAO");
    const tAmbos = await abrirSessao(ambos.email);
    const { est } = await base();
    const pag = await registar(tAmbos, est.id, 100_00n);
    await expect(confirmar(tAmbos, pag)).rejects.toThrow();
    expect((await db.pagamento.findUnique({ where: { id: pag } }))?.estado).toBe("REGISTADO");
    await confirmar(p.tDir, pag);
    const final = await db.pagamento.findUnique({ where: { id: pag } });
    expect(final?.estado).toBe("CONFIRMADO");
    expect(final?.confirmadoPorId).toBe(p.dir.id);
    const aud = await db.eventoAuditoria.findFirst({
      where: { acao: "PAGAMENTO_CONFIRMADO", entidadeId: pag },
    });
    expect(aud?.actorId).toBe(p.dir.id);
  });

  it("data futura, valor ≤ 0 e anulação sem motivo são recusados; anular só antes de confirmar", async () => {
    const p = await pessoas();
    const { est } = await base();
    await expect(
      db.$queryRaw`SELECT registar_pagamento(${est.id}::uuid, 0::bigint, 'TPA'::"MetodoPagamento", ${dia}::date, 'AUTOMATICO'::"ModoAlocacao", NULL, NULL, ${p.tFin}, NULL)`,
    ).rejects.toThrow();
    await expect(
      db.$queryRaw`SELECT registar_pagamento(${est.id}::uuid, 5::bigint, 'TPA'::"MetodoPagamento", '2999-01-01'::date, 'AUTOMATICO'::"ModoAlocacao", NULL, NULL, ${p.tFin}, NULL)`,
    ).rejects.toThrow();
    const pag = await registar(p.tFin, est.id, 100_00n);
    await expect(
      db.$executeRaw`SELECT anular_pagamento(${pag}::uuid, 'x', ${p.tFin}, NULL)`,
    ).rejects.toThrow();
    await db.$executeRaw`SELECT anular_pagamento(${pag}::uuid, 'Registado por engano', ${p.tFin}, NULL)`;
    await expect(confirmar(p.tDir, pag)).rejects.toThrow();
    const pag2 = await registar(p.tFin, est.id, 100_00n);
    await confirmar(p.tDir, pag2);
    await expect(
      db.$executeRaw`SELECT anular_pagamento(${pag2}::uuid, 'Registado por engano', ${p.tFin}, NULL)`,
    ).rejects.toThrow();
  });
});

describe("financeiro — alocação, saldo e reconciliação", () => {
  it("aloca ao encargo mais antigo; parcial; excedente fica como crédito; reconciliação sem violações", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const e3 = await encargo(est.id, tipo.id, ano.id, "2026-12", 100_00n, "2026-12-05");
    const e1 = await encargo(est.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const e2 = await encargo(est.id, tipo.id, ano.id, "2026-11", 100_00n, "2026-11-05");
    await confirmar(p.tDir, await registar(p.tFin, est.id, 150_00n));
    const v = async () =>
      Object.fromEntries(
        (
          await db.$queryRaw<
            { id: string; pago: bigint }[]
          >`SELECT id, pago FROM "VistaEncargo" WHERE "estudanteId" = ${est.id}::uuid`
        ).map((r) => [r.id, r.pago]),
      );
    expect(await v()).toMatchObject({ [e1.id]: 100_00n, [e2.id]: 50_00n, [e3.id]: 0n });
    await confirmar(p.tDir, await registar(p.tFin, est.id, 400_00n));
    expect(await v()).toMatchObject({ [e1.id]: 100_00n, [e2.id]: 100_00n, [e3.id]: 100_00n });
    const somaPagos = 550_00n;
    const aloc = await db.alocacaoPagamento.aggregate({
      where: { estudanteId: est.id },
      _sum: { valor: true },
    });
    expect(aloc._sum.valor).toBe(300_00n);
    expect(somaPagos - (aloc._sum.valor ?? 0n)).toBe(250_00n); // crédito
    expect(await reconc(est.id)).toEqual([]);
  });

  it("modo MANUAL não aloca sozinho; alocação manual respeita pagamento e encargo", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const e1 = await encargo(est.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const pag = await registar(p.tFin, est.id, 100_00n, "MANUAL");
    await confirmar(p.tDir, pag);
    expect(await db.alocacaoPagamento.count({ where: { pagamentoId: pag } })).toBe(0);
    const alocar = (v: bigint, tok = p.tFin) =>
      db.$executeRaw`SELECT alocar_pagamento_manual(${pag}::uuid, ${e1.id}::uuid, ${v}::bigint, ${tok}, NULL)`;
    await expect(alocar(101_00n)).rejects.toThrow();
    await expect(alocar(40_00n, p.tDir)).rejects.toThrow(); // Direcção não tem financeiro:editar
    await alocar(40_00n);
    await alocar(60_00n);
    await expect(alocar(1n)).rejects.toThrow();
    expect(await reconc(est.id)).toEqual([]);
  });

  it("não se aloca a encargo de outro estudante", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const outro = await c.estudante();
    const eOutro = await encargo(outro.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const pag = await registar(p.tFin, est.id, 100_00n, "MANUAL");
    await confirmar(p.tDir, pag);
    await expect(
      db.$executeRaw`SELECT alocar_pagamento_manual(${pag}::uuid, ${eOutro.id}::uuid, 10::bigint, ${p.tFin}, NULL)`,
    ).rejects.toThrow();
  });
});

describe("financeiro — recibos sem saltos", () => {
  it("confirmações concorrentes geram números consecutivos e distintos", async () => {
    const p = await pessoas();
    const { est } = await base();
    const pags = [];
    for (let i = 0; i < 8; i++) pags.push(await registar(p.tFin, est.id, 10_00n));
    const tokens = [p.tDir, p.tDir2];
    const rs = await Promise.allSettled(pags.map((pg, i) => confirmar(tokens[i % 2]!, pg)));
    expect(rs.every((r) => r.status === "fulfilled")).toBe(true);
    const recibos = await db.recibo.findMany({
      where: { estudanteId: est.id },
      orderBy: { numero: "asc" },
    });
    expect(recibos).toHaveLength(8);
    const nums = recibos.map((r) => r.numero);
    expect(new Set(nums).size).toBe(8);
    expect(nums[7]! - nums[0]!).toBe(7);
  });

  it("confirmar duas vezes o mesmo pagamento em simultâneo: só uma vence, um só recibo", async () => {
    const p = await pessoas();
    const { est } = await base();
    const pag = await registar(p.tFin, est.id, 10_00n);
    const rs = await Promise.allSettled([
      confirmar(p.tDir, pag),
      confirmar(p.tDir2, pag),
      confirmar(p.tDir, pag),
    ]);
    expect(rs.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.recibo.count({ where: { pagamentoId: pag } })).toBe(1);
  });

  it("se a auditoria falha, nada fica gravado e o número do recibo não se perde", async () => {
    const p = await pessoas();
    const { est } = await base();
    const a = await registar(p.tFin, est.id, 10_00n);
    const b = await registar(p.tFin, est.id, 10_00n);
    const ra = await confirmar(p.tDir, a);
    const na = (await db.recibo.findUnique({ where: { id: ra } }))!.numero;
    await comFalhaDeAuditoria("PAGAMENTO_CONFIRMADO", () => confirmar(p.tDir, b));
    expect((await db.pagamento.findUnique({ where: { id: b } }))?.estado).toBe("REGISTADO");
    expect(await db.recibo.count({ where: { pagamentoId: b } })).toBe(0);
    const rb = await confirmar(p.tDir, b);
    expect((await db.recibo.findUnique({ where: { id: rb } }))!.numero).toBe(na + 1);
  });
});

describe("financeiro — estornos com dupla aprovação", () => {
  it("quem propõe não aprova; crédito é revertido primeiro e depois as alocações mais recentes", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const e1 = await encargo(est.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const e2 = await encargo(est.id, tipo.id, ano.id, "2026-11", 100_00n, "2026-11-05");
    const pag = await registar(p.tFin, est.id, 250_00n); // 200 alocados + 50 crédito
    await confirmar(p.tDir, pag);
    const ambos = await c.principal("FINANCEIRO", "DIRECCAO");
    const tAmbos = await abrirSessao(ambos.email);
    const pedido = await propor(tAmbos, pag, 80_00n);
    await expect(aprovar(tAmbos, pedido)).rejects.toThrow(); // o proponente
    await expect(aprovar(p.tFin, pedido)).rejects.toThrow(); // sem permissão
    await aprovar(p.tDir, pedido);
    const est1 = await db.estorno.findUnique({ where: { id: pedido } });
    expect(est1?.estado).toBe("APROVADO");
    expect(est1?.valorCredito).toBe(50_00n);
    const pagos = Object.fromEntries(
      (
        await db.$queryRaw<
          { id: string; pago: bigint }[]
        >`SELECT id, pago FROM "VistaEncargo" WHERE "estudanteId" = ${est.id}::uuid`
      ).map((r) => [r.id, r.pago]),
    );
    expect(pagos[e2.id]).toBe(70_00n); // 30 retirados do mais recente
    expect(pagos[e1.id]).toBe(100_00n);
    expect((await db.pagamento.findUnique({ where: { id: pag } }))?.estado).toBe("CONFIRMADO");
    expect(await reconc(est.id)).toEqual([]);
    // estornar o resto → ESTORNADO; mais um já excede
    const resto = await propor(p.tFin, pag, 170_00n);
    const extra = await propor(p.tFin, pag, 1n); // pendente ao mesmo tempo: ambos cabem isoladamente
    await aprovar(p.tDir2, resto);
    await expect(aprovar(p.tDir, extra)).rejects.toThrow(); // já não há nada por estornar
    expect((await db.pagamento.findUnique({ where: { id: pag } }))?.estado).toBe("ESTORNADO");
    expect(await reconc(est.id)).toEqual([]);
    await expect(propor(p.tFin, pag, 1n)).rejects.toThrow();
  });

  it("estorno parcial reverte a alocação MAIS RECENTE, mesmo que o encargo seja mais antigo (alocações manuais)", async () => {
    const p = await pessoas();
    const { ano, tipo, est } = await base();
    const antigo = await encargo(est.id, tipo.id, ano.id, "2026-10", 100_00n, "2026-10-05");
    const recente = await encargo(est.id, tipo.id, ano.id, "2026-12", 100_00n, "2026-12-05");
    const pag = await registar(p.tFin, est.id, 200_00n, "MANUAL");
    await confirmar(p.tDir, pag);
    const alocar = (enc: string) =>
      db.$executeRaw`SELECT alocar_pagamento_manual(${pag}::uuid, ${enc}::uuid, 100_00::bigint, ${p.tFin}, NULL)`;
    await alocar(recente.id); // primeiro (mais antiga no tempo)
    await new Promise((r) => setTimeout(r, 20));
    await alocar(antigo.id); // depois (mais recente no tempo)
    await aprovar(p.tDir, await propor(p.tFin, pag, 60_00n));
    const pagos = Object.fromEntries(
      (
        await db.$queryRaw<
          { id: string; pago: bigint }[]
        >`SELECT id, pago FROM "VistaEncargo" WHERE "estudanteId" = ${est.id}::uuid`
      ).map((r) => [r.id, r.pago]),
    );
    expect(pagos[antigo.id]).toBe(40_00n); // a alocação feita por último é a primeira a ser revertida
    expect(pagos[recente.id]).toBe(100_00n);
    expect(await reconc(est.id)).toEqual([]);
  });

  it("estorno rejeitado não altera nada; aprovado/rejeitado é definitivo", async () => {
    const p = await pessoas();
    const { est } = await base();
    const pag = await registar(p.tFin, est.id, 100_00n);
    await confirmar(p.tDir, pag);
    const pedido = await propor(p.tFin, pag, 100_00n);
    await expect(
      db.$executeRaw`SELECT rejeitar_estorno(${pedido}::uuid, 'x', ${p.tDir}, NULL)`,
    ).rejects.toThrow();
    await db.$executeRaw`SELECT rejeitar_estorno(${pedido}::uuid, 'Não se justifica', ${p.tDir}, NULL)`;
    await expect(aprovar(p.tDir2, pedido)).rejects.toThrow();
    expect((await db.pagamento.findUnique({ where: { id: pag } }))?.estado).toBe("CONFIRMADO");
    expect(
      await db.estorno.updateMany({ where: { id: pedido }, data: { estado: "APROVADO" } }).then(
        () => "ok",
        () => "erro",
      ),
    ).toBe("erro");
    expect(await reconc(est.id)).toEqual([]);
  });

  it("a aplicação não cria nem decide estornos por SQL directo", async () => {
    const p = await pessoas();
    const { est } = await base();
    const pag = await registar(p.tFin, est.id, 100_00n);
    await confirmar(p.tDir, pag);
    await expect(
      db.estorno.create({
        data: {
          pagamentoId: pag,
          valor: 100_00n,
          motivo: "forjado",
          estado: "APROVADO",
          propostoPorId: p.fin.id,
          decididoPorId: p.dir.id,
          decididoEm: new Date(),
        },
      }),
    ).rejects.toThrow();
    expect(await db.estorno.count({ where: { pagamentoId: pag } })).toBe(0);
  });
});

describe("financeiro — reconciliação detecta violações", () => {
  it("detecta pagamento confirmado sem recibo (injectado pelo dono, fora do procedimento)", async () => {
    const p = await pessoas();
    const { est } = await base();
    const pag = await registar(p.tFin, est.id, 100_00n);
    await confirmar(p.tDir, pag);
    expect(await reconc(est.id)).toEqual([]);
    await dbAdmin.$executeRaw`ALTER TABLE "Recibo" DISABLE TRIGGER recibo_guarda`;
    try {
      await dbAdmin.$executeRaw`DELETE FROM "Recibo" WHERE "pagamentoId" = ${pag}::uuid`;
    } finally {
      await dbAdmin.$executeRaw`ALTER TABLE "Recibo" ENABLE TRIGGER recibo_guarda`;
    }
    expect((await reconc(est.id)).map((r) => r.verificacao)).toContain(
      "pagamento_confirmado_sem_recibo",
    );
  });
});
