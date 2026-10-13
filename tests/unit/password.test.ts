import { describe, expect, it } from "vitest";
import { hashPassword, validarPoliticaPassword, verificarPassword } from "@/server/auth/password";
import { gerarToken, hashToken } from "@/server/auth/tokens";
import { sanitizar } from "@/server/audit";

describe("política de palavras-passe", () => {
  it("recusa curtas, só números, comuns, com o email ou com o nome", () => {
    expect(validarPoliticaPassword("curta1")).not.toHaveLength(0);
    expect(validarPoliticaPassword("1234567890123")).not.toHaveLength(0);
    expect(validarPoliticaPassword("password123")).not.toHaveLength(0);
    expect(validarPoliticaPassword("aaaaaaaaaaaa")).not.toHaveLength(0);
    expect(
      validarPoliticaPassword("maria.silva-2026x", { email: "maria.silva@escola.test" }),
    ).not.toHaveLength(0);
    expect(
      validarPoliticaPassword("Joaquim-Segredo-9", { nome: "Joaquim Santos" }),
    ).not.toHaveLength(0);
  });
  it("aceita uma palavra-passe longa e variada", () => {
    expect(
      validarPoliticaPassword("Cavalo-Azul-Chuva-73", { email: "a@b.test", nome: "Ana" }),
    ).toHaveLength(0);
  });
});

describe("hash e tokens", () => {
  it("argon2id: verifica certa e errada; hash não contém a password", async () => {
    const h = await hashPassword("Cavalo-Azul-Chuva-73");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(h).not.toContain("Cavalo");
    expect(await verificarPassword(h, "Cavalo-Azul-Chuva-73")).toBe(true);
    expect(await verificarPassword(h, "errada")).toBe(false);
    expect(await verificarPassword("lixo", "qualquer")).toBe(false);
  });
  it("tokens têm 256 bits, são únicos e só o hash coincide", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a.token).not.toBe(b.token);
    expect(Buffer.from(a.token, "base64url")).toHaveLength(32);
    expect(hashToken(a.token)).toBe(a.tokenHash);
    expect(a.tokenHash).not.toBe(a.token);
  });
});

describe("sanitização da auditoria", () => {
  it("omite chaves sensíveis em profundidade", () => {
    expect(
      sanitizar({
        nome: "x",
        passwordHash: "abc",
        aninhado: { token: "t", ok: 1 },
        lista: [{ secret: "s" }],
      }),
    ).toEqual({
      nome: "x",
      passwordHash: "[omitido]",
      aninhado: { token: "[omitido]", ok: 1 },
      lista: [{ secret: "[omitido]" }],
    });
  });
});
