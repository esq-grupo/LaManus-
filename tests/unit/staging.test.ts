import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// Revisão do Codex à H3: o Compose de staging não pode dar à aplicação as credenciais do dono da base de dados,
// e o exemplo de configuração citado no procedimento tem de existir no repositório.
const compose = parse(readFileSync("docker-compose.staging.yml", "utf8")) as {
  services: Record<
    string,
    {
      env_file?: unknown;
      environment?: Record<string, string>;
      ports?: string[];
      read_only?: boolean;
      cap_drop?: string[];
    }
  >;
};

describe("docker-compose.staging.yml", () => {
  const app = compose.services.app!;
  it("a aplicação NÃO recebe credenciais administrativas", () => {
    expect(app.env_file).toBeUndefined(); // um env_file despejaria POSTGRES_PASSWORD e afins no contentor
    const texto = JSON.stringify(app);
    for (const proibido of [
      "POSTGRES_PASSWORD",
      "POSTGRES_USER",
      "ADMIN_DATABASE_URL",
      "postgresql://lamanus:",
      "SEED_PASSWORD",
    ]) {
      expect(texto, proibido).not.toContain(proibido);
    }
    expect(Object.keys(app.environment ?? {}).sort()).toEqual([
      "APP_URL",
      "AUTH_DATABASE_URL",
      "DATABASE_URL",
      "NODE_ENV",
    ]);
    expect(app.environment!.DATABASE_URL).toContain("postgresql://lamanus_app:");
    expect(app.environment!.AUTH_DATABASE_URL).toContain("postgresql://lamanus_auth:");
  });
  it("a aplicação corre endurecida e só o Caddy publica portas; a base de dados não", () => {
    expect(app.read_only).toBe(true);
    expect(app.cap_drop).toEqual(["ALL"]);
    expect(app.ports).toBeUndefined();
    expect(compose.services.db!.ports).toBeUndefined();
    expect(compose.services.caddy!.ports).toEqual(["80:80", "443:443"]);
  });
  it("só o serviço de migrações (perfil «migrar») usa a ligação do dono", () => {
    for (const [nome, s] of Object.entries(compose.services)) {
      if (nome === "migrar" || nome === "db") continue;
      expect(JSON.stringify(s), nome).not.toContain("ADMIN_DATABASE_URL");
    }
    expect(compose.services.migrar!.environment!.ADMIN_DATABASE_URL).toContain("${POSTGRES_USER}");
  });
});

describe(".env.staging.example", () => {
  it("existe, está no Git (não ignorado) e só tem marcadores, nunca segredos reais", () => {
    expect(existsSync(".env.staging.example")).toBe(true);
    expect(
      spawnSync("git", ["check-ignore", "--no-index", "-q", ".env.staging.example"]).status,
    ).toBe(1); // 1 = não ignorado
    const rastreado = execFileSync("git", ["ls-files", "--error-unmatch", ".env.staging.example"], {
      encoding: "utf8",
    });
    expect(rastreado.trim()).toBe(".env.staging.example");
    const t = readFileSync(".env.staging.example", "utf8");
    for (const chave of [
      "DOMINIO",
      "POSTGRES_PASSWORD",
      "APP_DB_PASSWORD",
      "AUTH_DB_PASSWORD",
      "APP_URL",
    ])
      expect(t).toContain(chave);
    for (const linha of t.split("\n").filter((l) => /PASSWORD=/.test(l)))
      expect(linha).toContain("<");
  });
  it("o ficheiro real .env.staging continua ignorado pelo Git", () => {
    expect(spawnSync("git", ["check-ignore", "--no-index", "-q", ".env.staging"]).status).toBe(0);
  });
});
