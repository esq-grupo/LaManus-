import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUTH, COOKIE_SESSAO_NOME, opcoesCookieSessao } from "@/server/auth/config";
import { iniciarSessao } from "@/server/auth/login";
import { definirMailer, type Email } from "@/server/auth/mailer";
import { pedirRecuperacao, redefinirPassword } from "@/server/auth/recuperacao";
import { revogarSessaoPorToken, validarSessao } from "@/server/auth/sessao";
import { hashToken } from "@/server/auth/tokens";
import { db, criarUser, limparUser, PASSWORD_TESTE, prepararBd } from "./ajuda";

const criados: string[] = [];
const emails: Email[] = [];
const novo = async (...a: Parameters<typeof criarUser>) => {
  const u = await criarUser(...a);
  criados.push(u.id);
  return u;
};

beforeAll(async () => {
  await prepararBd();
  definirMailer({ enviar: async (e) => void emails.push(e) });
});
afterAll(async () => {
  for (const id of criados) await limparUser(id);
});

describe("login", () => {
  it("credenciais correctas criam sessão válida com os papéis certos", async () => {
    const u = await novo(["SECRETARIA"]);
    const r = await iniciarSessao(u.email, PASSWORD_TESTE, { ip: "10.0.0.1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await validarSessao(r.token);
    expect(s?.id).toBe(u.id);
    expect(s?.papeis).toEqual(["SECRETARIA"]);
  });

  it("o token não é guardado em claro (só o hash)", async () => {
    const u = await novo(["DOCENTE"]);
    const r = await iniciarSessao(u.email, PASSWORD_TESTE);
    if (!r.ok) throw new Error("login falhou");
    const linhas = await db.session.findMany({ where: { userId: u.id } });
    expect(linhas.some((l) => l.tokenHash === r.token)).toBe(false);
    expect(linhas.some((l) => l.tokenHash === hashToken(r.token))).toBe(true);
  });

  it("password errada e email inexistente dão a mesma resposta (sem enumeração)", async () => {
    const u = await novo(["DOCENTE"]);
    const a = await iniciarSessao(u.email, "errada-errada-1");
    const b = await iniciarSessao("naoexiste@teste.lamanu.test", "errada-errada-1");
    expect(a).toEqual({ ok: false, motivo: "CREDENCIAIS" });
    expect(b).toEqual({ ok: false, motivo: "CREDENCIAIS" });
  });

  it("bloqueia a conta após 5 falhas, mesmo com a password certa, e audita", async () => {
    const u = await novo(["DOCENTE"]);
    for (let i = 0; i < AUTH.maxFalhasConta; i++) await iniciarSessao(u.email, "errada-errada-1");
    const r = await iniciarSessao(u.email, PASSWORD_TESTE);
    expect(r).toEqual({ ok: false, motivo: "BLOQUEADO" });
    const ev = await db.eventoAuditoria.findMany({
      where: { actorId: u.id, acao: "CONTA_BLOQUEADA_TEMPORARIAMENTE" },
    });
    expect(ev.length).toBe(1);
  });

  it("tentativas SIMULTÂNEAS não contornam o limite: no máximo 5 palavras-passe são verificadas", async () => {
    const u = await novo(["DOCENTE"]);
    const rajada = await Promise.all(
      Array.from({ length: 30 }, () => iniciarSessao(u.email, "errada-errada-1")),
    );
    expect(rajada.every((r) => !r.ok)).toBe(true);
    const verificadas = await db.eventoAuditoria.count({
      where: { actorId: u.id, acao: "LOGIN_FALHADO" },
    });
    expect(verificadas).toBeLessThanOrEqual(AUTH.maxFalhasConta);
    expect(await iniciarSessao(u.email, PASSWORD_TESTE)).toEqual({
      ok: false,
      motivo: "BLOQUEADO",
    });
  });

  it("logins legítimos repetidos não bloqueiam a conta (o contador zera em cada sucesso)", async () => {
    const u = await novo(["DOCENTE"]);
    for (let i = 0; i < AUTH.maxFalhasConta + 3; i++) {
      expect((await iniciarSessao(u.email, "errada-errada-1")).ok).toBe(false);
      expect((await iniciarSessao(u.email, PASSWORD_TESTE)).ok).toBe(true);
    }
  });

  it("depois de o bloqueio expirar, o contador recomeça (uma falha não volta a bloquear)", async () => {
    const u = await novo(["DOCENTE"]);
    for (let i = 0; i < AUTH.maxFalhasConta; i++) await iniciarSessao(u.email, "errada-errada-1");
    await db.user.update({
      where: { id: u.id },
      data: { bloqueadoAte: new Date(Date.now() - 1000) },
    });
    expect(await iniciarSessao(u.email, "errada-errada-1")).toEqual({
      ok: false,
      motivo: "CREDENCIAIS",
    });
    expect((await iniciarSessao(u.email, PASSWORD_TESTE)).ok).toBe(true);
  });

  it("conta desactivada ou bloqueada pela administração não entra", async () => {
    const d = await novo(["DOCENTE"], { estado: "DESACTIVADO" });
    const b = await novo(["DOCENTE"], { estado: "BLOQUEADO" });
    expect((await iniciarSessao(d.email, PASSWORD_TESTE)).ok).toBe(false);
    expect((await iniciarSessao(b.email, PASSWORD_TESTE)).ok).toBe(false);
  });

  it("limite por IP: muitas falhas na mesma ligação bloqueiam novas tentativas", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 250)}-t${Date.now()}`;
    const u = await novo(["DOCENTE"]);
    for (let i = 0; i < AUTH.maxFalhasIp; i++)
      await db.tentativaLogin.create({ data: { identificador: "x", ip, sucesso: false } });
    expect(await iniciarSessao(u.email, PASSWORD_TESTE, { ip })).toEqual({
      ok: false,
      motivo: "LIMITE_IP",
    });
  });

  it("a falha de login deixa evento de auditoria sem a password", async () => {
    const u = await novo(["DOCENTE"]);
    await iniciarSessao(u.email, "segredo-que-nao-deve-aparecer");
    const ev = await db.eventoAuditoria.findMany({ where: { actorId: u.id } });
    expect(ev.length).toBeGreaterThan(0);
    expect(JSON.stringify(ev)).not.toContain("segredo-que-nao-deve-aparecer");
  });
});

describe("sessões", () => {
  it("sessão revogada deixa de funcionar imediatamente", async () => {
    const u = await novo(["DIRECCAO"]);
    const r = await iniciarSessao(u.email, PASSWORD_TESTE);
    if (!r.ok) throw new Error("login falhou");
    expect(await validarSessao(r.token)).not.toBeNull();
    await revogarSessaoPorToken(r.token);
    expect(await validarSessao(r.token)).toBeNull();
  });

  it("desactivar a conta invalida sessões já abertas", async () => {
    const u = await novo(["DIRECCAO"]);
    const r = await iniciarSessao(u.email, PASSWORD_TESTE);
    if (!r.ok) throw new Error("login falhou");
    await db.user.update({ where: { id: u.id }, data: { estado: "DESACTIVADO" } });
    expect(await validarSessao(r.token)).toBeNull();
  });

  it("sessão expira por inactividade e por prazo absoluto", async () => {
    const u = await novo(["DIRECCAO"]);
    const r = await iniciarSessao(u.email, PASSWORD_TESTE);
    if (!r.ok) throw new Error("login falhou");
    const h = hashToken(r.token);
    await db.session.update({
      where: { tokenHash: h },
      data: { ultimaActividade: new Date(Date.now() - AUTH.sessaoInactividadeMs - 1000) },
    });
    expect(await validarSessao(r.token)).toBeNull();
    await db.session.update({
      where: { tokenHash: h },
      data: { ultimaActividade: new Date(), expiraEm: new Date(Date.now() - 1000) },
    });
    expect(await validarSessao(r.token)).toBeNull();
  });

  it("token inventado, vazio ou nulo não dá sessão", async () => {
    expect(await validarSessao("inventado")).toBeNull();
    expect(await validarSessao("")).toBeNull();
    expect(await validarSessao(null)).toBeNull();
  });

  it("alteração de papéis tem efeito imediato na sessão em curso", async () => {
    const u = await novo(["SECRETARIA"]);
    const r = await iniciarSessao(u.email, PASSWORD_TESTE);
    if (!r.ok) throw new Error("login falhou");
    await db.userRole.deleteMany({ where: { userId: u.id } });
    expect((await validarSessao(r.token))?.papeis).toEqual([]);
  });

  it("cookie: httpOnly, sameSite=lax e secure em produção", () => {
    const o = opcoesCookieSessao(new Date(), true);
    expect(o).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(COOKIE_SESSAO_NOME.length).toBeGreaterThan(0);
  });
});

describe("recuperação de conta", () => {
  it("fluxo completo: link por email, nova password, link de uso único, sessões antigas revogadas", async () => {
    const u = await novo(["DOCENTE"]);
    const antiga = await iniciarSessao(u.email, PASSWORD_TESTE);
    if (!antiga.ok) throw new Error("login falhou");
    emails.length = 0;
    await pedirRecuperacao(u.email);
    const mail = emails.find((e) => e.para === u.email);
    expect(mail).toBeDefined();
    const token = mail!.texto.match(/redefinir\/([\w-]+)/)![1]!;

    expect((await redefinirPassword(token, "curta")).ok).toBe(false); // política
    const ok = await redefinirPassword(token, "Nova-Palavra-Segura-77");
    expect(ok.ok).toBe(true);
    expect((await redefinirPassword(token, "Outra-Palavra-Segura-88")).ok).toBe(false); // uso único
    expect(await validarSessao(antiga.token)).toBeNull(); // sessões antigas revogadas
    expect((await iniciarSessao(u.email, "Nova-Palavra-Segura-77")).ok).toBe(true);
    expect((await iniciarSessao(u.email, PASSWORD_TESTE)).ok).toBe(false);
  });

  it("falha no envio do email NÃO altera a resposta da recuperação (nem lança erro) e fica auditada", async () => {
    const u = await novo(["DOCENTE"]);
    definirMailer({
      enviar: async () => {
        throw new Error("SMTP em baixo: smtp://segredo@servidor");
      },
    });
    try {
      await expect(pedirRecuperacao(u.email)).resolves.toBeUndefined();
      await expect(pedirRecuperacao("ninguem@teste.lamanu.test")).resolves.toBeUndefined();
    } finally {
      definirMailer({ enviar: async (e) => void emails.push(e) });
    }
    const ev = await db.eventoAuditoria.findFirst({
      where: { actorId: u.id, acao: "RECUPERACAO_EMAIL_FALHOU" },
    });
    expect(ev).not.toBeNull();
    expect(JSON.stringify(ev)).not.toContain("segredo");
  });

  it("não revela se o email existe (nenhum email enviado para desconhecidos)", async () => {
    emails.length = 0;
    await pedirRecuperacao("ninguem@teste.lamanu.test");
    expect(emails).toHaveLength(0);
  });

  it("token inventado ou expirado é recusado", async () => {
    expect((await redefinirPassword("inventado", "Nova-Palavra-Segura-77")).ok).toBe(false);
    const u = await novo(["DOCENTE"]);
    emails.length = 0;
    await pedirRecuperacao(u.email);
    const token = emails[0]!.texto.match(/redefinir\/([\w-]+)/)![1]!;
    await db.passwordReset.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await redefinirPassword(token, "Nova-Palavra-Segura-77")).ok).toBe(false);
  });

  it("a redefinição não desbloqueia uma conta bloqueada pela administração", async () => {
    const u = await novo(["DOCENTE"], { estado: "BLOQUEADO" });
    emails.length = 0;
    await pedirRecuperacao(u.email);
    const token = emails[0]!.texto.match(/redefinir\/([\w-]+)/)![1]!;
    await redefinirPassword(token, "Nova-Palavra-Segura-77");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).estado).toBe("BLOQUEADO");
    expect((await iniciarSessao(u.email, "Nova-Palavra-Segura-77")).ok).toBe(false);
  });
});
