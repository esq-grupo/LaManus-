import { afterAll, describe, expect, it } from "vitest";
import { Cenario } from "./cenario";
import { abrirSessao, db } from "./ajuda";
import {
  alocarManual,
  anularEncargo,
  aprovarEstorno,
  calcularSaldo,
  confirmarPagamento,
  criarEncargo,
  criarTipo,
  dividasPorTurma,
  extractoDoEstudante,
  gerarEncargosMensais,
  listarTipos,
  obterRecibo,
  pagamentosPorConfirmar,
  proporEstorno,
  reconciliar,
  recebimentosPorPeriodo,
  registarPagamento,
  saldoDoEstudante,
} from "@/server/modules/financeiro";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { PAPEIS, type Papel } from "@/server/authz";

const c = new Cenario();
afterAll(() => c.limpar());

const hoje = new Date().toISOString().slice(0, 10);

async function ctx(u: { email: string }) {
  return { tokenSessao: await abrirSessao(u.email), ip: "127.0.0.1" };
}
async function cenarioBase() {
  const ano = await c.ano();
  const classe = await c.classe();
  const turma = await c.turma(ano.id, classe.id);
  const fin = await c.principal("FINANCEIRO");
  const dir = await c.principal("DIRECCAO");
  const dir2 = await c.principal("DIRECCAO");
  const tipo = await c.tipoEncargo(50_000_00n);
  return { ano, turma, fin, dir, dir2, tipo };
}
const pagamento = (estudanteId: string, valorKz: number | string, modoAlocacao = "AUTOMATICO") => ({
  estudanteId,
  valorKz,
  metodo: "TRANSFERENCIA",
  dataPagamento: hoje,
  modoAlocacao,
});

describe("financeiro — permissões por papel (servidor)", () => {
  const PODE_EDITAR: Papel[] = ["FINANCEIRO"];
  for (const papel of PAPEIS) {
    it(`${papel}: registar/criar tipo ${PODE_EDITAR.includes(papel) ? "permitido" : "negado"}`, async () => {
      const u = await c.principal(papel);
      const est = await c.estudante();
      const registar = registarPagamento(u, pagamento(est.id, 100), await ctx(u));
      const tipo = criarTipo(u, {
        nome: `X-${c.sufixo}-${papel}`,
        valorKz: 1000,
        periodicidade: "MENSAL",
      });
      if (PODE_EDITAR.includes(papel)) {
        await expect(registar).resolves.toBeTruthy();
        await expect(tipo).resolves.toBeTruthy();
        const t = await db.tipoEncargo.findFirst({ where: { nome: `X-${c.sufixo}-${papel}` } });
        if (t) c.tiposEncargo.push(t.id);
      } else {
        await expect(registar).rejects.toBeInstanceOf(ErroAutorizacao);
        await expect(tipo).rejects.toBeInstanceOf(ErroAutorizacao);
      }
    });
    it(`${papel}: confirmar ${papel === "DIRECCAO" ? "permitido" : "negado"}; estornar/aprovar conforme matriz`, async () => {
      const { fin } = await cenarioBase();
      const est = await c.estudante();
      const u = await c.principal(papel);
      const pag = await registarPagamento(fin, pagamento(est.id, 100), await ctx(fin));
      const r = confirmarPagamento(u, pag, await ctx(u));
      if (papel === "DIRECCAO") await expect(r).resolves.toBeTruthy();
      else await expect(r).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(aprovarEstorno(u, crypto.randomUUID(), undefined, await ctx(u))).rejects.toThrow(
        papel === "DIRECCAO" ? ErroValidacao : ErroAutorizacao,
      );
      await expect(
        proporEstorno(u, { pagamentoId: pag, valorKz: 1, motivo: "Duplicado" }, await ctx(u)),
      ).rejects.toThrow(papel === "FINANCEIRO" ? ErroValidacao : ErroAutorizacao);
    });
  }

  it("sem token de sessão nada se regista nem confirma", async () => {
    const { fin, dir } = await cenarioBase();
    const est = await c.estudante();
    await expect(
      registarPagamento(fin, pagamento(est.id, 100), { tokenSessao: null }),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    const pag = await registarPagamento(fin, pagamento(est.id, 100), await ctx(fin));
    await expect(confirmarPagamento(dir, pag, { tokenSessao: null })).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    // token de OUTRA pessoa (Financeiro) com a identidade da Direcção: a BD usa a sessão, não o `actor`
    await expect(confirmarPagamento(dir, pag, await ctx(fin))).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
  });
});

describe("financeiro — encargos", () => {
  it("geração mensal em lote é idempotente e só abrange matrículas ACTIVAS do ano", async () => {
    const { ano, turma, fin, tipo } = await cenarioBase();
    const a = await c.estudante();
    const b = await c.estudante();
    const anulada = await c.estudante();
    await c.matricular(a.id, turma.id, ano.id);
    await c.matricular(b.id, turma.id, ano.id);
    const m = await c.matricular(anulada.id, turma.id, ano.id);
    await db.matricula.update({ where: { id: m.id }, data: { estado: "ANULADA" } });
    const mes = `${ano.inicio.getUTCFullYear()}-10`;
    const r1 = await gerarEncargosMensais(fin, {
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: mes,
    });
    expect(r1).toEqual({ elegiveis: 2, criados: 2, jaExistentes: 0 });
    const r2 = await gerarEncargosMensais(fin, {
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: mes,
    });
    expect(r2).toEqual({ elegiveis: 2, criados: 0, jaExistentes: 2 });
    expect(await db.encargo.count({ where: { tipoEncargoId: tipo.id } })).toBe(2);
    const e = await db.encargo.findFirstOrThrow({ where: { estudanteId: a.id } });
    expect(e.valor).toBe(50_000_00n);
    expect(e.vencimento.toISOString().slice(0, 10)).toBe(`${mes}-05`);
    await expect(
      gerarEncargosMensais(fin, {
        tipoEncargoId: tipo.id,
        anoLectivoId: ano.id,
        referencia: "1999-01",
      }),
    ).rejects.toBeInstanceOf(ErroValidacao);
    const unico = await c.tipoEncargo(1000_00n, "UNICO");
    await expect(
      gerarEncargosMensais(fin, { tipoEncargoId: unico.id, anoLectivoId: ano.id, referencia: mes }),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });

  it("duplicado, valores inválidos e anulação com pagamentos", async () => {
    const { ano, fin, dir, tipo } = await cenarioBase();
    const est = await c.estudante();
    const dados = {
      estudanteId: est.id,
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: "MAT",
      valorKz: 10_000,
      vencimento: "2026-10-10",
    };
    const e = await criarEncargo(fin, dados);
    await expect(criarEncargo(fin, dados)).rejects.toBeInstanceOf(ErroValidacao);
    await expect(
      criarEncargo(fin, { ...dados, referencia: "X", valorKz: "10,5" }),
    ).rejects.toBeInstanceOf(ErroValidacao);
    await expect(
      criarEncargo(fin, { ...dados, referencia: "X", valorKz: 0 }),
    ).rejects.toBeInstanceOf(ErroValidacao);
    await confirmarPagamento(
      dir,
      await registarPagamento(fin, pagamento(est.id, 10_000), await ctx(fin)),
      await ctx(dir),
    );
    await expect(anularEncargo(fin, e.id, "Lançado por engano")).rejects.toBeInstanceOf(
      ErroValidacao,
    );
    const e2 = await criarEncargo(fin, { ...dados, referencia: "OUTRO" });
    await expect(anularEncargo(fin, e2.id, "x")).rejects.toBeInstanceOf(ErroValidacao);
    await anularEncargo(fin, e2.id, "Lançado por engano");
    expect(
      await db.eventoAuditoria.count({ where: { acao: "ENCARGO_ANULADO", entidadeId: e2.id } }),
    ).toBe(1);
  });
});

describe("financeiro — saldo, extracto e leitura por papel", () => {
  it("saldo = Σ encargos − Σ alocações; crédito do excedente; extracto com estados", async () => {
    const { ano, fin, dir, tipo } = await cenarioBase();
    const est = await c.estudante();
    for (const [ref, venc] of [
      ["A", "2020-01-05"],
      ["B", "2099-01-05"],
    ] as const)
      await criarEncargo(fin, {
        estudanteId: est.id,
        tipoEncargoId: tipo.id,
        anoLectivoId: ano.id,
        referencia: ref,
        valorKz: 100,
        vencimento: venc,
      });
    expect(await calcularSaldo(est.id)).toMatchObject({
      encargos: 200_00n,
      pago: 0n,
      emDivida: 200_00n,
      vencido: 100_00n,
      credito: 0n,
    });
    await confirmarPagamento(
      dir,
      await registarPagamento(fin, pagamento(est.id, 150), await ctx(fin)),
      await ctx(dir),
    );
    expect(await calcularSaldo(est.id)).toMatchObject({
      pago: 150_00n,
      emDivida: 50_00n,
      vencido: 0n,
      credito: 0n,
    });
    await confirmarPagamento(
      dir,
      await registarPagamento(fin, pagamento(est.id, 80), await ctx(fin)),
      await ctx(dir),
    );
    expect(await calcularSaldo(est.id)).toMatchObject({
      pago: 200_00n,
      emDivida: 0n,
      credito: 30_00n,
    });
    const ex = await extractoDoEstudante(fin, est.id);
    expect(ex.encargos.map((e) => e.estado)).toEqual(["PAGO", "PAGO"]);
    expect(ex.pagamentos).toHaveLength(2);
    expect(ex.pagamentos.every((p) => p.recibo)).toBe(true);
    expect(await reconciliar(dir)).toEqual([]);
  });

  it("escopo: Estudante só o seu; Encarregado só educando verificado/activo; Docente/Admin nada; Docente+Encarregado não vê alunos da turma", async () => {
    const { ano, turma, fin, dir, tipo } = await cenarioBase();
    const uEst = await c.principal("ESTUDANTE");
    const estA = await c.estudante({ userId: uEst.id });
    const estB = await c.estudante();
    const uEnc = await c.principal("ENCARREGADO");
    const enc = await c.encarregado(uEnc.id);
    await c.ligar(estB.id, enc.id, { verificado: true, autorizacaoActiva: true });
    const estC = await c.estudante();
    await c.ligar(estC.id, enc.id, { verificado: false, autorizacaoActiva: true });
    const estD = await c.estudante();
    await c.ligar(estD.id, enc.id, { verificado: true, autorizacaoActiva: false });
    for (const e of [estA, estB, estC, estD])
      await criarEncargo(fin, {
        estudanteId: e.id,
        tipoEncargoId: tipo.id,
        anoLectivoId: ano.id,
        referencia: "R",
        valorKz: 100,
        vencimento: "2026-10-10",
      });
    const pagB = await registarPagamento(fin, pagamento(estB.id, 100), await ctx(fin));
    await confirmarPagamento(dir, pagB, await ctx(dir));

    await expect(saldoDoEstudante(uEst, estA.id)).resolves.toBeTruthy();
    await expect(saldoDoEstudante(uEst, estB.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(saldoDoEstudante(uEnc, estB.id)).resolves.toBeTruthy();
    await expect(saldoDoEstudante(uEnc, estC.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(saldoDoEstudante(uEnc, estD.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(saldoDoEstudante(uEnc, estA.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(obterRecibo(uEnc, pagB)).resolves.toBeTruthy();
    await expect(obterRecibo(uEst, pagB)).rejects.toBeInstanceOf(ErroAutorizacao);
    for (const papel of ["DOCENTE", "RH", "QUALIDADE", "ADMIN_TECNICO"] as const) {
      const u = await c.principal(papel);
      await expect(saldoDoEstudante(u, estA.id), papel).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(listarTipos(u), papel).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(pagamentosPorConfirmar(u), papel).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    // quem acumula DOCENTE + ENCARREGADO não ganha acesso às contas dos alunos que ensina
    const uMisto = await c.principal("DOCENTE", "ENCARREGADO");
    const func = await c.funcionario(uMisto.id);
    const disc = await c.disciplina();
    await db.turmaDisciplina.create({
      data: { turmaId: turma.id, disciplinaId: disc.id, docenteId: func.id },
    });
    await c.matricular(estA.id, turma.id, ano.id);
    await expect(saldoDoEstudante(uMisto, estA.id)).rejects.toBeInstanceOf(ErroAutorizacao);
  });

  it("encarregado com validade expirada perde o acesso", async () => {
    const { ano, fin, tipo } = await cenarioBase();
    const uEnc = await c.principal("ENCARREGADO");
    const enc = await c.encarregado(uEnc.id);
    const est = await c.estudante();
    await c.ligar(est.id, enc.id, {
      verificado: true,
      autorizacaoActiva: true,
      validoAte: new Date("2020-01-01"),
    });
    await criarEncargo(fin, {
      estudanteId: est.id,
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: "R",
      valorKz: 100,
      vencimento: "2026-10-10",
    });
    await expect(saldoDoEstudante(uEnc, est.id)).rejects.toBeInstanceOf(ErroAutorizacao);
  });
});

describe("financeiro — pagamentos e estornos (serviço)", () => {
  it("mensagens de regra de negócio em português; alocação manual; estorno com dupla aprovação", async () => {
    const { ano, fin, dir, dir2, tipo } = await cenarioBase();
    const est = await c.estudante();
    const enc = await criarEncargo(fin, {
      estudanteId: est.id,
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: "R",
      valorKz: 100,
      vencimento: "2026-10-10",
    });
    await expect(
      registarPagamento(
        fin,
        { ...pagamento(est.id, 100), dataPagamento: "2999-01-01" },
        await ctx(fin),
      ),
    ).rejects.toThrow(/futura/);
    await expect(
      registarPagamento(fin, pagamento(est.id, "abc"), await ctx(fin)),
    ).rejects.toBeInstanceOf(ErroValidacao);
    const ambos = await c.principal("FINANCEIRO", "DIRECCAO");
    const pag = await registarPagamento(ambos, pagamento(est.id, 100, "MANUAL"), await ctx(ambos));
    await expect(confirmarPagamento(ambos, pag, await ctx(ambos))).rejects.toThrow(/Quem registou/);
    await confirmarPagamento(dir, pag, await ctx(dir));
    await expect(confirmarPagamento(dir2, pag, await ctx(dir2))).rejects.toBeInstanceOf(
      ErroValidacao,
    );
    await expect(
      alocarManual(fin, { pagamentoId: pag, encargoId: enc.id, valorKz: 101 }, await ctx(fin)),
    ).rejects.toBeInstanceOf(ErroValidacao);
    await alocarManual(fin, { pagamentoId: pag, encargoId: enc.id, valorKz: 100 }, await ctx(fin));
    expect((await calcularSaldo(est.id)).emDivida).toBe(0n);

    const pedido = await proporEstorno(
      ambos,
      { pagamentoId: pag, valorKz: 40, motivo: "Pago em duplicado" },
      await ctx(ambos),
    );
    await expect(aprovarEstorno(ambos, pedido, "ok", await ctx(ambos))).rejects.toThrow(/propôs/);
    await aprovarEstorno(dir, pedido, "Confirmado com o banco", await ctx(dir));
    expect(await calcularSaldo(est.id)).toMatchObject({
      pago: 60_00n,
      emDivida: 40_00n,
      credito: 0n,
    });
    expect(await reconciliar(dir)).toEqual([]);
    const rel = await recebimentosPorPeriodo(dir, { de: hoje, ate: hoje });
    expect(rel.liquido).toBe(rel.bruto - rel.estornado);
    expect(rel.estornado).toBeGreaterThanOrEqual(40_00n);
  });

  it("relatório de dívidas por turma soma por estudante; recebimentos exige gestão", async () => {
    const { ano, turma, fin, dir, tipo } = await cenarioBase();
    const a = await c.estudante();
    const b = await c.estudante();
    await c.matricular(a.id, turma.id, ano.id);
    await c.matricular(b.id, turma.id, ano.id);
    await criarEncargo(fin, {
      estudanteId: a.id,
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: "R",
      valorKz: 100,
      vencimento: "2020-01-05",
    });
    await criarEncargo(fin, {
      estudanteId: b.id,
      tipoEncargoId: tipo.id,
      anoLectivoId: ano.id,
      referencia: "R",
      valorKz: 300,
      vencimento: "2099-01-05",
    });
    await confirmarPagamento(
      dir,
      await registarPagamento(fin, pagamento(b.id, 100), await ctx(fin)),
      await ctx(dir),
    );
    const r = await dividasPorTurma(fin, turma.id);
    expect(r.totalEmDivida).toBe(300_00n);
    expect(r.totalVencido).toBe(100_00n);
    expect(r.linhas).toHaveLength(2);
    const docente = await c.principal("DOCENTE");
    await expect(dividasPorTurma(docente, turma.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    const estu = await c.principal("ESTUDANTE");
    await expect(recebimentosPorPeriodo(estu, { de: hoje, ate: hoje })).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    await expect(
      recebimentosPorPeriodo(fin, { de: "2026-02-01", ate: "2026-01-01" }),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });
});
