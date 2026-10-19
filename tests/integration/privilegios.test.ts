import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { verificarCatalogo, verificarTentativas } from "@/server/seguranca/privilegios";
import { prepararBd } from "./ajuda";

// H1: a configuração REAL dos papéis é verificada por consulta ao catálogo e por tentativas recusadas (ADR-0008).
beforeAll(prepararBd);

const url = (v: string | undefined) => {
  if (!v) throw new Error("variável de ligação em falta");
  return v;
};
const admin = () =>
  new pg.Client({
    connectionString: url(process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL).split("?")[0],
  });

describe("privilégios dos papéis da base de dados", () => {
  let c: pg.Client;
  beforeAll(async () => {
    c = admin();
    await c.connect();
  });
  afterAll(() => c.end());

  it("o catálogo só tem os privilégios previstos", async () => {
    expect(await verificarCatalogo(c)).toEqual([]);
  });

  it("as tentativas proibidas são recusadas pelas duas ligações", async () => {
    expect(await verificarTentativas(url(process.env.DATABASE_URL), "lamanus_app")).toEqual([]);
    expect(await verificarTentativas(url(process.env.AUTH_DATABASE_URL), "lamanus_auth")).toEqual(
      [],
    );
  });

  it("detecta um privilégio a mais (e repõe-no)", async () => {
    await c.query(`GRANT UPDATE ON "Session" TO lamanus_app`);
    try {
      const falhas = await verificarCatalogo(c);
      expect(falhas.some((f) => f.includes("Session"))).toBe(true);
      expect(
        (await verificarTentativas(url(process.env.DATABASE_URL), "lamanus_app")).length,
      ).toBeGreaterThan(0);
    } finally {
      await c.query(`REVOKE ALL ON "Session" FROM lamanus_app`);
    }
    expect(await verificarCatalogo(c)).toEqual([]);
  });
});
