import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Uma cópia feita com um pg_dump MAIS NOVO que o servidor não se restaura (ex.: «SET transaction_timeout»): tem de ser recusada.
const url = () => (process.env.ADMIN_DATABASE_URL ?? "").split("?")[0]!;

function comPgDumpFalso(versao: string) {
  const base = mkdtempSync(path.join(tmpdir(), "pgbin-"));
  const servidor = spawnSync("psql", [url(), "-Atc", "show server_version_num"], {
    encoding: "utf8",
  })
    .stdout.trim()
    .slice(0, 2);
  const bin = path.join(base, servidor, "bin");
  mkdirSync(bin, { recursive: true });
  for (const nome of ["pg_dump", "pg_restore"]) {
    const f = path.join(bin, nome);
    writeFileSync(f, `#!/bin/sh\necho "${nome} (PostgreSQL) ${versao}"\n`);
    chmodSync(f, 0o755);
  }
  return { base, bin };
}
const correr = (base: string) =>
  spawnSync("bash", ["-c", `source scripts/pg-cliente.sh "${url()}" && echo "PG_DUMP=$PG_DUMP"`], {
    encoding: "utf8",
    env: { ...process.env, PG_BIN_BASE: base },
  });

describe("scripts/pg-cliente.sh", () => {
  it("recusa um pg_dump de versão superior à do servidor, com mensagem clara", () => {
    const { base } = comPgDumpFalso("99.0");
    const r = correr(base);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(
      /pg_dump é da versão 99 e o servidor é da \d+; a cópia não se restauraria/,
    );
  });
  it("aceita (e usa) um pg_dump do mesmo major do servidor", () => {
    const { base, bin } = comPgDumpFalso("16.0");
    const servidor = path.basename(path.dirname(bin));
    const r = correr(base);
    // o falso diz 16; só passa se o servidor for >= 16 (o do projecto é o 16)
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain(`PG_DUMP=${path.join(base, servidor, "bin", "pg_dump")}`);
  });
});
