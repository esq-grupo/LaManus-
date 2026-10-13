import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { definirMailer } from "@/server/auth/mailer";
import { iniciarSessao } from "@/server/auth/login";
import { validarSessao } from "@/server/auth/sessao";
import {
  ErroAutorizacao,
  alterarPapeis,
  criarUtilizador,
  definirEstado,
  listarUtilizadores,
  revogarSessoesDe,
} from "@/server/modules/utilizadores";
import { db, criarUser, limparUser, PASSWORD_TESTE, prepararBd } from "./ajuda";

const criados: string[] = [];
const principal = async (papeis: Parameters<typeof criarUser>[0]) => {
  const u = await criarUser(papeis);
  criados.push(u.id);
  return { id: u.id, papeis: u.papeis, email: u.email };
};

beforeAll(async () => {
  await prepararBd();
  definirMailer({ enviar: async () => undefined });
});
afterAll(async () => {
  for (const id of criados) await limparUser(id);
});

describe("gestão de utilizadores — negativos de permissão", () => {
  it("só o Admin técnico cria, altera papéis, desactiva e revoga sessões", async () => {
    const alvo = await principal(["DOCENTE"]);
    for (const papel of [
      "DIRECCAO",
      "SECRETARIA",
      "FINANCEIRO",
      "DOCENTE",
      "RH",
      "QUALIDADE",
      "ESTUDANTE",
      "ENCARREGADO",
    ] as const) {
      const actor = await principal([papel]);
      await expect(
        criarUtilizador(actor, {
          nome: "Alguém Novo",
          email: `n-${papel}@teste.lamanu.test`,
          papeis: ["DOCENTE"],
        }),
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(alterarPapeis(actor, alvo.id, ["DIRECCAO"])).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
      await expect(definirEstado(actor, alvo.id, "DESACTIVADO")).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
      await expect(revogarSessoesDe(actor, alvo.id)).rejects.toBeInstanceOf(ErroAutorizacao);
    }
  });

  it("Direcção vê a lista de utilizadores mas Estudante/Docente não", async () => {
    expect((await listarUtilizadores(await principal(["DIRECCAO"]))).length).toBeGreaterThan(0);
    await expect(listarUtilizadores(await principal(["ESTUDANTE"]))).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    await expect(listarUtilizadores(await principal(["DOCENTE"]))).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
  });

  it("o Admin técnico não altera os próprios papéis nem a própria conta (separação de funções) e fica auditado", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    await expect(
      alterarPapeis(admin, admin.id, ["ADMIN_TECNICO", "DIRECCAO"]),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(definirEstado(admin, admin.id, "DESACTIVADO")).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    const ev = await db.eventoAuditoria.findMany({
      where: { actorId: admin.id, acao: "ACESSO_NEGADO" },
    });
    expect(ev.length).toBe(1);
  });
});

describe("gestão de utilizadores — fluxos permitidos", () => {
  it("cria utilizador sem nunca definir password; audita; email duplicado recusado", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const email = `novo-${Date.now()}@teste.lamanu.test`;
    const id = await criarUtilizador(admin, { nome: "Pessoa Nova", email, papeis: ["SECRETARIA"] });
    criados.push(id);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "UTILIZADOR_CRIADO", entidadeId: id },
    });
    expect(ev?.actorId).toBe(admin.id);
    expect(JSON.stringify(ev)).not.toMatch(/passwordHash|argon2/);
    await expect(
      criarUtilizador(admin, { nome: "Pessoa Nova", email, papeis: ["SECRETARIA"] }),
    ).rejects.toThrow();
    // A conta nova não consegue entrar com palavras-passe adivinhadas.
    expect((await iniciarSessao(email, PASSWORD_TESTE)).ok).toBe(false);
  });

  it("se o email do convite falhar, o admin recebe mensagem clara, a conta existe e a falha fica auditada", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const email = `falha-${Date.now()}@teste.lamanu.test`;
    definirMailer({
      enviar: async () => {
        throw new Error("SMTP em baixo: smtp://segredo@servidor");
      },
    });
    try {
      await expect(
        criarUtilizador(admin, { nome: "Pessoa Sem Email", email, papeis: ["SECRETARIA"] }),
      ).rejects.toThrow(/Reenviar link/);
    } finally {
      definirMailer({ enviar: async () => undefined });
    }
    const criado = await db.user.findUnique({ where: { email } });
    expect(criado).not.toBeNull();
    if (criado) criados.push(criado.id);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "CONVITE_EMAIL_FALHOU", entidadeId: criado?.id },
    });
    expect(ev).not.toBeNull();
    expect(JSON.stringify(ev)).not.toContain("segredo");
  });

  it("alterar papéis audita antes/depois e tem efeito imediato", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const alvo = await principal(["DOCENTE"]);
    const sessao = await iniciarSessao(alvo.email, PASSWORD_TESTE);
    if (!sessao.ok) throw new Error("login falhou");
    await alterarPapeis(admin, alvo.id, ["FINANCEIRO"]);
    expect((await validarSessao(sessao.token))?.papeis).toEqual(["FINANCEIRO"]);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "PAPEIS_ALTERADOS", entidadeId: alvo.id },
    });
    expect(ev?.antes).toEqual({ papeis: ["DOCENTE"] });
    expect(ev?.depois).toEqual({ papeis: ["FINANCEIRO"] });
  });

  it("desactivar termina as sessões abertas", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const alvo = await principal(["DOCENTE"]);
    const s = await iniciarSessao(alvo.email, PASSWORD_TESTE);
    if (!s.ok) throw new Error("login falhou");
    await definirEstado(admin, alvo.id, "DESACTIVADO");
    expect(await validarSessao(s.token)).toBeNull();
  });
});

describe("auditoria é só de inserção", () => {
  it("UPDATE, DELETE e TRUNCATE em EventoAuditoria são bloqueados pela base de dados", async () => {
    const ev = await db.eventoAuditoria.create({ data: { acao: "TESTE", entidade: "Teste" } });
    await expect(
      db.eventoAuditoria.update({ where: { id: ev.id }, data: { acao: "ALTERADO" } }),
    ).rejects.toThrow(/apenas de inserção/);
    await expect(db.eventoAuditoria.delete({ where: { id: ev.id } })).rejects.toThrow(
      /apenas de inserção/,
    );
    await expect(db.$executeRawUnsafe('TRUNCATE TABLE "EventoAuditoria"')).rejects.toThrow(
      /apenas de inserção/,
    );
  });
});
