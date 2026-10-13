import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { PAPEIS, type Papel } from "@/server/authz";
import { anularMatricula, matricular, transferirTurma } from "@/server/modules/matriculas";
import { db, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

async function base() {
  const ano = await c.ano();
  const classe = await c.classe();
  const turmaA = await c.turma(ano.id, classe.id, "A");
  const turmaB = await c.turma(ano.id, classe.id, "B");
  const sec = await c.principal("SECRETARIA");
  const est = await c.estudante();
  return { ano, classe, turmaA, turmaB, sec, est };
}

describe("matrículas — regras de negócio", () => {
  it("não permite duas matrículas activas no mesmo ano (mensagem clara)", async () => {
    const { turmaA, turmaB, sec, est } = await base();
    await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    // Mesmo noutra turma do mesmo ano: bloqueado. (RENOVACAO porque já há histórico.)
    await expect(
      matricular(sec, { estudanteId: est.id, turmaId: turmaB.id, tipo: "RENOVACAO" }),
    ).rejects.toThrow(/matrícula activa neste ano/);
  });

  it("CONCORRÊNCIA: 10 matrículas simultâneas do mesmo estudante e ano → exactamente 1 criada", async () => {
    const { turmaA, sec, est } = await base();
    const r = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" }),
      ),
    );
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.matricula.count({ where: { estudanteId: est.id, estado: "ACTIVA" } })).toBe(1);
  });

  it("a BASE DE DADOS recusa a 2.ª matrícula activa mesmo sem passar pelo serviço", async () => {
    const { ano, turmaA, turmaB, est } = await base();
    await db.matricula.create({
      data: { estudanteId: est.id, turmaId: turmaA.id, anoLectivoId: ano.id, tipo: "NOVA" },
    });
    await expect(
      db.matricula.create({
        data: { estudanteId: est.id, turmaId: turmaB.id, anoLectivoId: ano.id, tipo: "NOVA" },
      }),
    ).rejects.toThrow();
    // Uma ANULADA/TRANSFERIDA não conta: pode coexistir com uma activa.
    await db.matricula.create({
      data: {
        estudanteId: est.id,
        turmaId: turmaB.id,
        anoLectivoId: ano.id,
        tipo: "NOVA",
        estado: "ANULADA",
      },
    });
  });

  it("a BASE DE DADOS recusa uma matrícula cuja turma é de outro ano lectivo", async () => {
    const { turmaA, est } = await base();
    const outroAno = await c.ano();
    await expect(
      db.matricula.create({
        data: { estudanteId: est.id, turmaId: turmaA.id, anoLectivoId: outroAno.id, tipo: "NOVA" },
      }),
    ).rejects.toThrow();
  });

  it("tipo NOVA só sem histórico; RENOVAÇÃO só com histórico", async () => {
    const { turmaA, sec, est } = await base();
    await expect(
      matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "RENOVACAO" }),
    ).rejects.toThrow(/use «Nova»/);
    const m = await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    await anularMatricula(sec, m, "Matrícula feita por engano");
    // Anulada não conta como histórico.
    await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    const ano2 = await c.ano("PLANEADO", 1);
    const turma2 = await c.turma(ano2.id, (await c.classe()).id);
    await expect(
      matricular(sec, { estudanteId: est.id, turmaId: turma2.id, tipo: "NOVA" }),
    ).rejects.toThrow(/use «Renovação»/);
    await matricular(sec, { estudanteId: est.id, turmaId: turma2.id, tipo: "RENOVACAO" });
  });

  it("recusa ano fechado, estudante inactivo e identificadores inventados", async () => {
    const { classe, sec, est } = await base();
    const fechado = await c.ano("FECHADO");
    const tf = await c.turma(fechado.id, classe.id);
    await expect(
      matricular(sec, { estudanteId: est.id, turmaId: tf.id, tipo: "NOVA" }),
    ).rejects.toThrow(/fechado/);
    await db.estudante.update({ where: { id: est.id }, data: { estado: "INACTIVO" } });
    const { turmaA } = await base();
    await expect(
      matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" }),
    ).rejects.toThrow(/inactivo/);
    await expect(
      matricular(sec, { estudanteId: "não-é-uuid", turmaId: turmaA.id, tipo: "NOVA" }),
    ).rejects.toBeInstanceOf(ErroValidacao);
  });
});

describe("transferência de turma", () => {
  it("fecha a matrícula antiga, abre a nova, guarda histórico e audita com motivo", async () => {
    const { turmaA, turmaB, sec, est } = await base();
    const m = await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    const nova = await transferirTurma(sec, {
      matriculaId: m,
      novaTurmaId: turmaB.id,
      motivo: "Pedido do encarregado",
    });
    const todas = await db.matricula.findMany({
      where: { estudanteId: est.id },
      orderBy: { createdAt: "asc" },
    });
    expect(todas.map((x) => x.estado).sort()).toEqual(["ACTIVA", "TRANSFERIDA"]);
    expect(todas.find((x) => x.estado === "ACTIVA")?.id).toBe(nova);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "MATRICULA_TRANSFERIDA", entidadeId: nova },
    });
    expect(ev?.actorId).toBe(sec.id);
    expect(ev?.depois).toMatchObject({ turmaId: turmaB.id, motivo: "Pedido do encarregado" });
    expect(ev?.antes).toMatchObject({ turmaId: turmaA.id });
  });

  it("exige motivo, turma diferente e o mesmo ano lectivo", async () => {
    const { turmaA, sec, est, classe } = await base();
    const m = await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    await expect(
      transferirTurma(sec, { matriculaId: m, novaTurmaId: turmaA.id, motivo: "x" }),
    ).rejects.toThrow(/motivo/);
    await expect(
      transferirTurma(sec, { matriculaId: m, novaTurmaId: turmaA.id, motivo: "Mudança de turno" }),
    ).rejects.toThrow(/mesma/);
    const outroAno = await c.ano();
    const t2 = await c.turma(outroAno.id, classe.id);
    await expect(
      transferirTurma(sec, { matriculaId: m, novaTurmaId: t2.id, motivo: "Mudança de turno" }),
    ).rejects.toThrow(/mesmo ano/);
    expect(await db.matricula.count({ where: { estudanteId: est.id, estado: "ACTIVA" } })).toBe(1);
  });

  it("CONCORRÊNCIA: transferências simultâneas deixam sempre exactamente 1 matrícula activa", async () => {
    const { turmaA, turmaB, sec, est, ano, classe } = await base();
    const turmaC = await c.turma(ano.id, classe.id, "C");
    const m = await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    const r = await Promise.allSettled([
      transferirTurma(sec, { matriculaId: m, novaTurmaId: turmaB.id, motivo: "Pedido A" }),
      transferirTurma(sec, { matriculaId: m, novaTurmaId: turmaC.id, motivo: "Pedido B" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.matricula.count({ where: { estudanteId: est.id, estado: "ACTIVA" } })).toBe(1);
  });
});

describe("matrículas — negativos de permissão", () => {
  it("só Direcção e Secretaria matriculam, transferem e anulam; os outros 7 papéis são recusados", async () => {
    const { turmaA, turmaB, sec, est } = await base();
    const m = await matricular(sec, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" });
    const permitidos: Papel[] = ["DIRECCAO", "SECRETARIA"];
    for (const papel of PAPEIS.filter((p) => !permitidos.includes(p))) {
      const actor = await c.principal(papel);
      await expect(
        matricular(actor, { estudanteId: est.id, turmaId: turmaA.id, tipo: "NOVA" }),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(
        transferirTurma(actor, {
          matriculaId: m,
          novaTurmaId: turmaB.id,
          motivo: "Tentativa indevida",
        }),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(anularMatricula(actor, m, "Tentativa indevida"), papel).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
    }
    expect((await db.matricula.findUniqueOrThrow({ where: { id: m } })).estado).toBe("ACTIVA");
  });
});
