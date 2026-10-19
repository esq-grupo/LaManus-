import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { criarMailerSmtp, lerConfigSmtp } from "@/server/auth/smtp";

// D11: envio real por SMTP contra um servidor de email FALSO local (sem rede externa).
interface Recebido {
  de: string;
  para: string[];
  corpo: string;
  utilizador?: string;
}
const recebidos: Recebido[] = [];
let servidor: SMTPServer;
let porta = 0;

beforeAll(async () => {
  servidor = new SMTPServer({
    disabledCommands: ["STARTTLS"],
    authOptional: true,
    allowInsecureAuth: true,
    onAuth(auth, _s, cb) {
      if (auth.username === "escola" && auth.password === "segredo-ci")
        cb(null, { user: auth.username });
      else cb(new Error("credenciais inválidas"));
    },
    onData(stream, sessao, cb) {
      const partes: Buffer[] = [];
      stream.on("data", (p: Buffer) => partes.push(p));
      stream.on("end", () => {
        recebidos.push({
          de: sessao.envelope.mailFrom ? sessao.envelope.mailFrom.address : "",
          para: sessao.envelope.rcptTo.map((r) => r.address),
          corpo: Buffer.concat(partes).toString("utf8"),
          utilizador: (sessao.user as string | undefined) ?? undefined,
        });
        cb();
      });
    },
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  porta = (servidor.server.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())));

const base = () => ({
  host: "127.0.0.1",
  port: porta,
  seguro: false,
  remetente: "Lá Manu <nao-responder@escola.test>",
  semTls: true,
});

describe("envio de email por SMTP", () => {
  it("entrega o convite ao servidor de email, autenticado", async () => {
    const m = criarMailerSmtp({ ...base(), utilizador: "escola", palavraPasse: "segredo-ci" });
    await m.enviar({ para: "maria@exemplo.test", assunto: "Convite", texto: "Link: https://x/y" });
    const r = recebidos.at(-1)!;
    expect(r.para).toEqual(["maria@exemplo.test"]);
    expect(r.corpo).toContain("Subject: Convite");
    expect(r.corpo).toContain("Link: https://x/y");
    expect(r.utilizador).toBe("escola");
  });

  it("credenciais erradas ou servidor em baixo: erro genérico, sem credenciais nem detalhes", async () => {
    const errada = criarMailerSmtp({ ...base(), utilizador: "escola", palavraPasse: "ERRADA-9" });
    const e1 = await errada
      .enviar({ para: "a@b.test", assunto: "x", texto: "y" })
      .catch((e: Error) => e);
    const baixo = criarMailerSmtp({
      ...base(),
      port: 1,
      utilizador: "escola",
      palavraPasse: "segredo-ci",
    });
    const e2 = await baixo
      .enviar({ para: "a@b.test", assunto: "x", texto: "y" })
      .catch((e: Error) => e);
    for (const e of [e1, e2]) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toBe("Falha no envio de email (servidor SMTP).");
      expect((e as Error).message).not.toMatch(/ERRADA|segredo|escola|127\.0\.0\.1/);
    }
  });

  it("sem cifra o servidor é recusado (STARTTLS obrigatório) quando não se autoriza 'sem TLS'", async () => {
    const m = criarMailerSmtp({ ...base(), semTls: false });
    await expect(m.enviar({ para: "a@b.test", assunto: "x", texto: "y" })).rejects.toThrow(
      /Falha no envio/,
    );
  });
});

describe("configuração SMTP pelo ambiente", () => {
  it("sem SMTP_HOST não há SMTP; configuração incompleta falha de forma clara", () => {
    expect(lerConfigSmtp({})).toBeNull();
    expect(() => lerConfigSmtp({ SMTP_HOST: "h" })).toThrow(/SMTP_REMETENTE/);
    expect(() =>
      lerConfigSmtp({
        SMTP_HOST: "h",
        SMTP_REMETENTE: "a@b.test",
        SMTP_UTILIZADOR: "u",
      }),
    ).toThrow(/em conjunto/);
    expect(() =>
      lerConfigSmtp({
        SMTP_HOST: "h",
        SMTP_REMETENTE: "a@b.test",
        SMTP_PORT: "x",
      }),
    ).toThrow(/SMTP_PORT/);
  });

  it("porta 465 usa TLS directo; em produção 'sem TLS' é ignorado", () => {
    const e = { SMTP_HOST: "h", SMTP_REMETENTE: "a@b.test", SMTP_SEM_TLS: "sim" };
    expect(lerConfigSmtp({ ...e, SMTP_PORT: "465" })!.seguro).toBe(true);
    expect(lerConfigSmtp({ ...e, NODE_ENV: "production" })!.semTls).toBe(false);
    expect(lerConfigSmtp({ ...e, NODE_ENV: "development" })!.semTls).toBe(true);
  });
});
