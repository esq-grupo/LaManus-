import { randomUUID } from "node:crypto";
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
  paginarUtilizadores,
  contarUtilizadores,
  revogarSessoesDe,
} from "@/server/modules/utilizadores";
import {
  abrirSessao,
  db,
  dbAdmin,
  criarUser,
  limparUser,
  PASSWORD_TESTE,
  prepararBd,
} from "./ajuda";

const criados: string[] = [];
const ctx = async (u: { email: string }) => ({ tokenSessao: await abrirSessao(u.email) });
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
        criarUtilizador(
          actor,
          {
            nome: "Alguém Novo",
            email: `n-${papel}@teste.lamanu.test`,
            papeis: ["DOCENTE"],
          },
          await ctx(actor),
        ),
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(
        alterarPapeis(actor, alvo.id, ["DIRECCAO"], await ctx(actor)),
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(
        definirEstado(actor, alvo.id, "DESACTIVADO", await ctx(actor)),
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(revogarSessoesDe(actor, alvo.id, await ctx(actor))).rejects.toBeInstanceOf(
        ErroAutorizacao,
      );
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
      alterarPapeis(admin, admin.id, ["ADMIN_TECNICO", "DIRECCAO"], await ctx(admin)),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    await expect(
      definirEstado(admin, admin.id, "DESACTIVADO", await ctx(admin)),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
    const ev = await db.eventoAuditoria.findMany({
      where: { actorId: admin.id, acao: "ACESSO_NEGADO" },
    });
    expect(ev.length).toBe(1);
  });
});

describe("lista de utilizadores — limitada e pesquisável", () => {
  it("devolve no máximo o limite pedido, filtra por nome/email e conta o total", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const alvo = await principal(["DOCENTE"]);
    const todos = await contarUtilizadores(admin);
    expect(todos).toBeGreaterThanOrEqual(2);
    expect((await listarUtilizadores(admin, { limite: 1 })).length).toBe(1);
    const achados = await listarUtilizadores(admin, { q: alvo.email.toUpperCase() });
    expect(achados.map((u) => u.email)).toEqual([alvo.email]);
    expect(await contarUtilizadores(admin, alvo.email)).toBe(1);
    expect(await listarUtilizadores(admin, { q: "nao-existe-este-texto-xyz" })).toEqual([]);
    expect((await listarUtilizadores(admin, { limite: 100000 })).length).toBeLessThanOrEqual(200);
  });
  it("sem permissão de ver utilizadores é recusado", async () => {
    await expect(contarUtilizadores(await principal(["DOCENTE"]))).rejects.toBeInstanceOf(
      ErroAutorizacao,
    );
    await expect(
      paginarUtilizadores(await principal(["DOCENTE"]), { pagina: "1" }),
    ).rejects.toBeInstanceOf(ErroAutorizacao);
  });

  it("pagina sem repetir nem omitir e estabiliza a fronteira por nome igual", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const sufixo = randomUUID().slice(0, 8);
    const nome = `Fronteira-${sufixo}`;
    const contas = [
      `fronteira-${sufixo}-a@teste.lamanu.test`,
      `fronteira-${sufixo}-b@teste.lamanu.test`,
    ];
    const ids: string[] = [];

    try {
      for (const email of [...contas].reverse()) {
        const id = await criarUtilizador(
          admin,
          { nome, email, papeis: ["DOCENTE"] },
          await ctx(admin),
        );
        ids.push(id);
        criados.push(id);
      }

      const filtro = { q: nome, limite: 1 };
      const pagina1 = await paginarUtilizadores(admin, { ...filtro, pagina: "1" });
      const pagina2 = await paginarUtilizadores(admin, { ...filtro, pagina: "2" });
      const pagina3 = await paginarUtilizadores(admin, { ...filtro, pagina: "99" });

      expect(pagina1.total).toBe(2);
      expect(pagina1.paginas).toBe(2);
      expect(pagina1.pagina).toBe(1);
      expect(pagina1.de).toBe(1);
      expect(pagina1.ate).toBe(1);
      expect(pagina2.pagina).toBe(2);
      expect(pagina2.de).toBe(2);
      expect(pagina2.ate).toBe(2);
      expect(pagina3.pagina).toBe(2);
      expect(pagina3.itens).toEqual(pagina2.itens);

      const encontrados = [...pagina1.itens, ...pagina2.itens];
      expect(encontrados.map((u) => u.id).sort()).toEqual(ids.sort());
      expect(new Set(encontrados.map((u) => u.id)).size).toBe(2);
      expect(encontrados.map((u) => u.email)).toEqual(contas);

      for (const pagina of ["texto", "0", "-1", "1.5", "1e309", "1234567"]) {
        expect((await paginarUtilizadores(admin, { ...filtro, pagina })).pagina).toBe(1);
      }
    } finally {
      for (const id of ids) await limparUser(id);
    }
  });
});

describe("gestão de utilizadores — fluxos permitidos", () => {
  it("cria utilizador sem nunca definir password; audita; email duplicado recusado", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const email = `novo-${Date.now()}@teste.lamanu.test`;
    const id = await criarUtilizador(
      admin,
      { nome: "Pessoa Nova", email, papeis: ["SECRETARIA"] },
      await ctx(admin),
    );
    criados.push(id);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "UTILIZADOR_CRIADO", entidadeId: id },
    });
    expect(ev?.actorId).toBe(admin.id);
    expect(JSON.stringify(ev)).not.toMatch(/passwordHash|argon2/);
    await expect(
      criarUtilizador(
        admin,
        { nome: "Pessoa Nova", email, papeis: ["SECRETARIA"] },
        await ctx(admin),
      ),
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
        criarUtilizador(
          admin,
          { nome: "Pessoa Sem Email", email, papeis: ["SECRETARIA"] },
          await ctx(admin),
        ),
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
    await alterarPapeis(admin, alvo.id, ["FINANCEIRO"], await ctx(admin));
    expect((await validarSessao(sessao.token))?.papeis).toEqual(["FINANCEIRO"]);
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "PAPEIS_ALTERADOS", entidadeId: alvo.id },
    });
    expect(ev?.antes).toEqual({ papeis: ["DOCENTE"] });
    expect(ev?.depois).toMatchObject({ papeis: ["FINANCEIRO"] });
    expect(ev?.origem).toBe("BD"); // escrito pela função da BD que autenticou o autor pela sessão
  });

  it("desactivar termina as sessões abertas", async () => {
    const admin = await principal(["ADMIN_TECNICO"]);
    const alvo = await principal(["DOCENTE"]);
    const s = await iniciarSessao(alvo.email, PASSWORD_TESTE);
    if (!s.ok) throw new Error("login falhou");
    await definirEstado(admin, alvo.id, "DESACTIVADO", await ctx(admin));
    expect(await validarSessao(s.token)).toBeNull();
  });
});

describe("auditoria é só de inserção", () => {
  it("a aplicação NÃO consegue alterar, apagar nem fazer TRUNCATE de eventos (sem privilégio); nem o dono, por gatilho", async () => {
    const ev = await dbAdmin.eventoAuditoria.create({ data: { acao: "TESTE", entidade: "Teste" } });
    await expect(
      db.eventoAuditoria.update({ where: { id: ev.id }, data: { acao: "ALTERADO" } }),
    ).rejects.toThrow(/permission denied/);
    await expect(db.eventoAuditoria.delete({ where: { id: ev.id } })).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.$executeRawUnsafe('TRUNCATE TABLE "EventoAuditoria"')).rejects.toThrow(
      /permission denied/,
    );
    // Defesa em profundidade: mesmo o dono é travado pelo gatilho.
    await expect(
      dbAdmin.eventoAuditoria.update({ where: { id: ev.id }, data: { acao: "ALTERADO" } }),
    ).rejects.toThrow(/apenas de inserção/);
    await expect(dbAdmin.eventoAuditoria.delete({ where: { id: ev.id } })).rejects.toThrow(
      /apenas de inserção/,
    );
    await expect(dbAdmin.$executeRawUnsafe('TRUNCATE TABLE "EventoAuditoria"')).rejects.toThrow(
      /apenas de inserção/,
    );
  });
});
