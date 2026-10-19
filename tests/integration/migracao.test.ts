import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Cenario } from "./cenario";
import { dbAdmin, prepararBd } from "./ajuda";
import { validarFicheiro } from "@/lib/migracao/validar";
import { aplicarPlano, carregarContexto, reverterLote } from "@/server/migracao/aplicar";
import { lerFicheiro } from "@/server/migracao/ler";
import { construirExemplo } from "@/server/migracao/exemplo";

// Dados exclusivamente FICTÍCIOS (prefixo IMP-). A importação corre com a ligação de administração (dono).
const c = new Cenario();
beforeAll(prepararBd);

async function limparImportacao() {
  const ests = (
    await dbAdmin.estudante.findMany({
      where: { numeroProcesso: { startsWith: "IMP-" } },
      select: { id: true },
    })
  ).map((e) => e.id);
  await dbAdmin.$transaction(async (tx) => {
    await tx.encargo.deleteMany({ where: { estudanteId: { in: ests } } });
    await tx.pagamento.deleteMany({ where: { estudanteId: { in: ests } } });
    await tx.matricula.deleteMany({ where: { estudanteId: { in: ests } } });
    await tx.estudanteEncarregado.deleteMany({ where: { estudanteId: { in: ests } } });
    await tx.estudante.deleteMany({ where: { id: { in: ests } } });
    await tx.encarregado.deleteMany({ where: { bi: { startsWith: "ENCIMP" } } });
    await tx.loteMigracao.deleteMany({});
  });
}
afterAll(async () => {
  await limparImportacao();
  await c.limpar();
});

async function cena() {
  await limparImportacao();
  const ano = await c.ano();
  const classe = await c.classe();
  const turma = await c.turma(ano.id, classe.id, "A");
  const buf = await construirExemplo({ ano: ano.nome, classe: classe.nome, turma: "A" });
  const planear = async () =>
    validarFicheiro(await lerFicheiro(buf), await carregarContexto(dbAdmin));
  return { ano, classe, turma, planear };
}

describe("importação — aplicar, repetir e reverter", () => {
  it("importa as válidas, rejeita as erradas e entrega o relatório; ligações entram por verificar; saldo = encargo de abertura", async () => {
    const x = await cena();
    const plano = await x.planear();
    const r = await aplicarPlano(dbAdmin, plano, {
      ficheiro: "exemplo.xlsx",
      sha256: "a".repeat(64),
    });
    expect(r.resumo.importadas).toEqual({
      estudantes: 2,
      encarregados: 2,
      ligacoes: 1,
      matriculas: 2,
      saldos: 1,
    });
    expect(r.resumo.rejeitadas).toBeGreaterThan(5);
    const est = await dbAdmin.estudante.findUniqueOrThrow({
      where: { numeroProcesso: "IMP-002" },
      include: { encarregados: true, matriculas: true, encargos: true },
    });
    expect(est.encarregados).toHaveLength(1);
    expect(est.encarregados[0]!.verificado).toBe(false); // o acesso aos portais é decidido pela Secretaria
    expect(est.matriculas[0]).toMatchObject({
      estado: "ACTIVA",
      tipo: "NOVA",
      turmaId: x.turma.id,
    });
    expect(est.encargos[0]).toMatchObject({
      valor: 5_000_000n,
      referencia: `ABERTURA-${x.ano.id}`,
    });
    // os inválidos não entraram
    expect(
      await dbAdmin.estudante.count({
        where: { numeroProcesso: { in: ["IMP-001", "IMP-003", "IMP-004", "IMP-006"] } },
      }),
    ).toBe(0);
    // auditoria do lote (sem dados pessoais)
    const ev = await dbAdmin.eventoAuditoria.findFirstOrThrow({
      where: { acao: "LOTE_MIGRACAO_APLICADO", entidadeId: r.lote.id },
    });
    expect(ev.origem).toBe("BD");
    expect(JSON.stringify(ev)).not.toContain("Fictícia");
  });

  it("repetir o mesmo ficheiro não duplica nada", async () => {
    const x = await cena();
    await aplicarPlano(dbAdmin, await x.planear(), {
      ficheiro: "exemplo.xlsx",
      sha256: "b".repeat(64),
    });
    const antes = await dbAdmin.estudante.count({
      where: { numeroProcesso: { startsWith: "IMP-" } },
    });
    const plano2 = await x.planear();
    expect([
      plano2.estudantes.length,
      plano2.encarregados.length,
      plano2.ligacoes.length,
      plano2.saldos.length,
    ]).toEqual([0, 0, 0, 0]);
    // matrículas já existentes são rejeitadas pelas regras (uma activa por ano), nunca duplicadas
    expect(plano2.matriculas).toHaveLength(0);
    await aplicarPlano(dbAdmin, plano2, { ficheiro: "exemplo.xlsx", sha256: "b".repeat(64) });
    expect(
      await dbAdmin.estudante.count({ where: { numeroProcesso: { startsWith: "IMP-" } } }),
    ).toBe(antes);
    expect(
      await dbAdmin.encargo.count({ where: { estudante: { numeroProcesso: "IMP-002" } } }),
    ).toBe(1);
  });

  it("reverter apaga só o que o lote criou; recusa (sem apagar nada) se já há pagamentos", async () => {
    const x = await cena();
    const r = await aplicarPlano(dbAdmin, await x.planear(), {
      ficheiro: "exemplo.xlsx",
      sha256: "c".repeat(64),
    });
    const preexistente = await c.estudante();
    // dependência criada depois da importação: um pagamento do IMP-002
    const est = await dbAdmin.estudante.findUniqueOrThrow({ where: { numeroProcesso: "IMP-002" } });
    const user = await c.principal("FINANCEIRO");
    await dbAdmin.pagamento.create({
      data: {
        estudanteId: est.id,
        valor: 100n,
        metodo: "TPA",
        dataPagamento: new Date("2026-10-01"),
        registadoPorId: user.id,
      },
    });
    await expect(reverterLote(dbAdmin, r.lote.id)).rejects.toThrow();
    expect(
      await dbAdmin.estudante.count({ where: { numeroProcesso: { in: ["IMP-002", "IMP-005"] } } }),
    ).toBe(2); // nada foi apagado
    expect(
      (await dbAdmin.loteMigracao.findUniqueOrThrow({ where: { id: r.lote.id } })).estado,
    ).toBe("APLICADO");
    await dbAdmin.pagamento.deleteMany({ where: { estudanteId: est.id } });
    await reverterLote(dbAdmin, r.lote.id);
    expect(
      await dbAdmin.estudante.count({ where: { numeroProcesso: { startsWith: "IMP-" } } }),
    ).toBe(0);
    expect(await dbAdmin.encarregado.count({ where: { bi: { startsWith: "ENCIMP" } } })).toBe(0);
    expect(await dbAdmin.estudante.findUnique({ where: { id: preexistente.id } })).not.toBeNull(); // o que já existia fica
    expect(
      (await dbAdmin.loteMigracao.findUniqueOrThrow({ where: { id: r.lote.id } })).estado,
    ).toBe("REVERTIDO");
    await expect(reverterLote(dbAdmin, r.lote.id)).rejects.toThrow(/já foi revertido/);
  });

  it("se algo falha a meio, nada fica gravado (uma transacção por lote)", async () => {
    const x = await cena();
    const plano = await x.planear();
    // estraga uma matrícula (turma que não existe) para provocar o erro DEPOIS de estudantes e encarregados criados
    plano.matriculas[0]!.turmaId = "00000000-0000-4000-8000-000000000000";
    plano.matriculas[0]!.anoLectivoId = x.ano.id;
    await expect(
      aplicarPlano(dbAdmin, plano, { ficheiro: "x.xlsx", sha256: "d".repeat(64) }),
    ).rejects.toThrow();
    expect(
      await dbAdmin.estudante.count({ where: { numeroProcesso: { startsWith: "IMP-" } } }),
    ).toBe(0);
    expect(await dbAdmin.loteMigracao.count()).toBe(0);
  });
});
