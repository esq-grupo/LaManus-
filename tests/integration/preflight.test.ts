import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { procurarProblemas } from "../../scripts/preflight-migracoes";
import { db, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

describe("pré-verificação das migrações (db:preflight)", () => {
  it("numa base sem duplicados não encontra problemas; com uma «Nova» duplicada indica o estudante", async () => {
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      expect(
        (await procurarProblemas(cliente)).filter((p) =>
          p.linhas.some((l) => String(l.numeroProcesso ?? "").startsWith("T-")),
        ),
      ).toEqual([]);

      // Simula uma base antiga (anterior ao índice) com uma matrícula inicial duplicada.
      const ano1 = await c.ano();
      const ano2 = await c.ano("PLANEADO", 1);
      const classe = await c.classe();
      const t1 = await c.turma(ano1.id, classe.id);
      const t2 = await c.turma(ano2.id, classe.id);
      const e = await c.estudante();
      await db.$executeRawUnsafe('DROP INDEX "Matricula_uma_nova_por_estudante"');
      try {
        await db.matricula.create({
          data: { estudanteId: e.id, turmaId: t1.id, anoLectivoId: ano1.id, tipo: "NOVA" },
        });
        await db.matricula.create({
          data: { estudanteId: e.id, turmaId: t2.id, anoLectivoId: ano2.id, tipo: "NOVA" },
        });
        const problemas = await procurarProblemas(cliente);
        const nova = problemas.find((p) => p.migracao === "20261015100000_matricula_nova_unica");
        expect(nova?.linhas).toContainEqual({
          numeroProcesso: e.numeroProcesso,
          matriculas_nova: 2,
        });
      } finally {
        await db.matricula.deleteMany({ where: { estudanteId: e.id } });
        await db.$executeRawUnsafe(
          `CREATE UNIQUE INDEX "Matricula_uma_nova_por_estudante" ON "Matricula" ("estudanteId") WHERE "tipo" = 'NOVA' AND "estado" IN ('ACTIVA', 'CONCLUIDA')`,
        );
      }
    } finally {
      await cliente.end();
    }
  });
});
