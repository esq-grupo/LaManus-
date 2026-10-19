import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Pré-verificação do servidor (Entrega H4): o ficheiro de segredos mal preenchido TEM de ser recusado.
const bom = (extra: Record<string, string> = {}, modo = 0o600) => {
  const v: Record<string, string> = {
    DOMINIO: "teste.escola.test",
    POSTGRES_USER: "lamanus",
    POSTGRES_PASSWORD: "A".repeat(20) + "1",
    POSTGRES_DB: "lamanus",
    APP_DB_PASSWORD: "B".repeat(20) + "2",
    AUTH_DB_PASSWORD: "C".repeat(20) + "3",
    APP_URL: "https://teste.escola.test",
    SMTP_HOST: "smtp.escola.test",
    SMTP_PORT: "587",
    SMTP_SEGURO: "nao",
    SMTP_REMETENTE: "Escola <nao-responder@escola.test>",
    ...extra,
  };
  const f = path.join(mkdtempSync(path.join(tmpdir(), "vs-")), ".env.teste");
  writeFileSync(
    f,
    Object.entries(v)
      .map(([k, x]) => `${k}=${x}`)
      .join("\n") + "\n",
  );
  chmodSync(f, modo);
  return f;
};
const correr = (f: string) =>
  spawnSync("bash", ["scripts/verificar-servidor.sh", "--so-env", f], { encoding: "utf8" });

describe("scripts/verificar-servidor.sh --so-env", () => {
  it("aceita um ficheiro correcto", () => {
    const r = correr(bom());
    expect(r.stdout).toContain("Ficheiro de segredos correcto.");
    expect(r.status).toBe(0);
  });
  it.each([
    ["permissões abertas", bom({}, 0o644), /permissões 644/],
    ["palavras-passe iguais", bom({ APP_DB_PASSWORD: "A".repeat(20) + "1" }), /DIFERENTES/],
    ["palavra-passe curta", bom({ AUTH_DB_PASSWORD: "curta" }), /AUTH_DB_PASSWORD com menos de 16/],
    [
      "marcador de exemplo",
      bom({ POSTGRES_PASSWORD: "<palavra-passe forte>" }),
      /marcador de exemplo/,
    ],
    ["APP_URL diferente do domínio", bom({ APP_URL: "https://outro.test" }), /APP_URL deve ser/],
    ["465 sem TLS directo", bom({ SMTP_PORT: "465", SMTP_SEGURO: "nao" }), /465 exige/],
    ["587 com TLS directo", bom({ SMTP_PORT: "587", SMTP_SEGURO: "sim" }), /587 usa STARTTLS/],
    ["SMTP em falta", bom({ SMTP_HOST: "" }), /SMTP_HOST vazio/],
  ])("recusa: %s", (_n, f, esperado) => {
    const r = correr(f);
    expect(r.stdout).toMatch(esperado);
    expect(r.status).toBe(1);
  });
  it("nunca imprime valores de segredos", () => {
    const r = correr(bom({ AUTH_DB_PASSWORD: "curta" }));
    expect(r.stdout + r.stderr).not.toContain("AAAAAAAA");
    expect(r.stdout + r.stderr).not.toContain("curta\n");
  });
});
