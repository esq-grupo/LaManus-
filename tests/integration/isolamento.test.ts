import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Cenario } from "./cenario";
import { abrirSessao, db, dbAdmin, prepararBd } from "./ajuda";
import { dbAuth } from "@/server/db-auth";
import { criarSessao } from "@/server/auth/sessao";

// ADR-0008: com a ligação de NEGÓCIO (`lamanus_app`) não se criam sessões, não se mudam papéis/permissões, não se lê a
// palavra-passe de ninguém e não se falsifica a auditoria «da BD». O módulo de autenticação (`lamanus_auth`) só faz o seu.
const c = new Cenario();
beforeAll(prepararBd);
afterAll(() => c.limpar());

const recusa = (p: Promise<unknown>) =>
  p.then(
    () => "aceite",
    () => "recusado",
  );

describe("a ligação de negócio (lamanus_app) não alcança sessões, papéis nem palavras-passe", () => {
  it("sessões, recuperações e tentativas de login: sem qualquer acesso", async () => {
    const u = await c.principal("ESTUDANTE");
    await abrirSessao(u.email);
    expect(await recusa(db.$queryRawUnsafe(`SELECT * FROM "Session" LIMIT 1`))).toBe("recusado");
    expect(await recusa(db.session.findMany())).toBe("recusado");
    expect(
      await recusa(
        db.$executeRawUnsafe(
          `INSERT INTO "Session" (id, "userId", "tokenHash", "expiraEm") VALUES (gen_random_uuid(), '${u.id}', '${randomUUID()}', now() + interval '1 day')`,
        ),
      ),
    ).toBe("recusado");
    expect(await recusa(db.$executeRawUnsafe(`UPDATE "Session" SET "revogadaEm" = NULL`))).toBe(
      "recusado",
    );
    expect(await recusa(db.passwordReset.findMany())).toBe("recusado");
    expect(
      await recusa(db.tentativaLogin.create({ data: { identificador: "x", sucesso: true } })),
    ).toBe("recusado");
    expect(await recusa(db.$executeRawUnsafe(`TRUNCATE "Session"`))).toBe("recusado");
  });

  it("papéis e permissões: não se atribuem nem se concedem", async () => {
    const u = await c.principal("ESTUDANTE");
    const direccao = await db.role.findUniqueOrThrow({ where: { codigo: "DIRECCAO" } });
    expect(await recusa(db.userRole.create({ data: { userId: u.id, roleId: direccao.id } }))).toBe(
      "recusado",
    );
    expect(await recusa(db.userRole.deleteMany({ where: { userId: u.id } }))).toBe("recusado");
    const perm = await db.permission.findFirstOrThrow({ where: { codigo: "pagamento:confirmar" } });
    const est = await db.role.findUniqueOrThrow({ where: { codigo: "ESTUDANTE" } });
    expect(
      await recusa(db.rolePermission.create({ data: { roleId: est.id, permissionId: perm.id } })),
    ).toBe("recusado");
    expect(await recusa(db.role.create({ data: { codigo: "SUPER", nome: "Super" } }))).toBe(
      "recusado",
    );
    expect(
      await recusa(db.permission.create({ data: { codigo: "tudo:fazer", descricao: "x" } })),
    ).toBe("recusado");
    // nada mudou
    expect(await dbAdmin.userRole.count({ where: { userId: u.id } })).toBe(1);
  });

  it("contas: não se criam, não se alteram (estado, palavra-passe) e a palavra-passe nunca se lê", async () => {
    const u = await c.principal("ESTUDANTE");
    expect(
      await recusa(db.user.update({ where: { id: u.id }, data: { estado: "DESACTIVADO" } })),
    ).toBe("recusado");
    expect(
      await recusa(
        db.$executeRawUnsafe(`UPDATE "User" SET "passwordHash" = 'x' WHERE id = '${u.id}'`),
      ),
    ).toBe("recusado");
    expect(await recusa(db.$executeRawUnsafe(`UPDATE "User" SET "tentativasFalhadas" = 0`))).toBe(
      "recusado",
    );
    expect(
      await recusa(
        db.$executeRawUnsafe(
          `INSERT INTO "User" (id, email, nome, "passwordHash", "updatedAt") VALUES (gen_random_uuid(), 'x@y.test', 'Xx', 'h', now())`,
        ),
      ),
    ).toBe("recusado");
    expect(await recusa(db.user.deleteMany({ where: { id: u.id } }))).toBe("recusado");
    expect(await recusa(db.$queryRawUnsafe(`SELECT "passwordHash" FROM "User" LIMIT 1`))).toBe(
      "recusado",
    );
    expect(await recusa(db.$queryRawUnsafe(`SELECT * FROM "User" LIMIT 1`))).toBe("recusado");
    // a leitura normal (sem a palavra-passe) continua a funcionar
    const lido = await db.user.findUnique({ where: { id: u.id } });
    expect(lido?.email).toBe(u.email);
    expect(lido).not.toHaveProperty("passwordHash");
  });

  it("auditoria: sem INSERT directo; a função da aplicação fixa a hora e a origem APP", async () => {
    const u = await c.principal("ESTUDANTE");
    expect(
      await recusa(
        db.$executeRawUnsafe(
          `INSERT INTO "EventoAuditoria" (id, acao, entidade, em, origem) VALUES (gen_random_uuid(), 'FORJADO', 'X', '2001-01-01', 'BD')`,
        ),
      ),
    ).toBe("recusado");
    expect(
      await recusa(
        db.$executeRawUnsafe(
          `INSERT INTO "EventoAuditoria" (id, acao, entidade) VALUES (gen_random_uuid(), 'FORJADO', 'X')`,
        ),
      ),
    ).toBe("recusado");
    await db.$executeRaw`SELECT registar_evento_app(${u.id}::uuid, 'TESTE_ISOLAMENTO', 'Teste', NULL, NULL, NULL, NULL)`;
    const ev = await dbAdmin.eventoAuditoria.findFirstOrThrow({
      where: { acao: "TESTE_ISOLAMENTO", actorId: u.id },
    });
    expect(ev.origem).toBe("APP"); // a aplicação nunca consegue escrever origem BD
    expect(Math.abs(ev.em.getTime() - Date.now())).toBeLessThan(60_000); // hora do servidor
    expect(await dbAdmin.eventoAuditoria.count({ where: { acao: "FORJADO" } })).toBe(0);
  });
});

describe("o módulo de autenticação (lamanus_auth) só faz o que lhe cabe", () => {
  it("cria sessões, mas não mexe em papéis, permissões, negócio nem auditoria", async () => {
    const u = await c.principal("ESTUDANTE");
    const s = await criarSessao(u.id, {});
    expect(s.token.length).toBeGreaterThan(20);
    const direccao = await dbAuth.role.findUniqueOrThrow({ where: { codigo: "DIRECCAO" } });
    expect(
      await recusa(dbAuth.userRole.create({ data: { userId: u.id, roleId: direccao.id } })),
    ).toBe("recusado");
    expect(await recusa(dbAuth.rolePermission.deleteMany({}))).toBe("recusado");
    expect(
      await recusa(dbAuth.user.update({ where: { id: u.id }, data: { estado: "DESACTIVADO" } })),
    ).toBe("recusado"); // só contadores e palavra-passe
    expect(await recusa(dbAuth.$queryRawUnsafe(`SELECT count(*) FROM "Nota"`))).toBe("recusado");
    expect(await recusa(dbAuth.$queryRawUnsafe(`SELECT count(*) FROM "Pagamento"`))).toBe(
      "recusado",
    );
    expect(
      await recusa(
        dbAuth.$executeRawUnsafe(
          `INSERT INTO "EventoAuditoria" (id, acao, entidade) VALUES (gen_random_uuid(), 'FORJADO', 'X')`,
        ),
      ),
    ).toBe("recusado");
    expect(await recusa(dbAuth.$executeRawUnsafe(`DELETE FROM "Session"`))).toBe("recusado");
    expect(await recusa(dbAuth.$executeRawUnsafe(`TRUNCATE "Session"`))).toBe("recusado");
  });
});

describe("as funções de contas autenticam o autor pela sessão", () => {
  const chamar = (sql: string) => recusa(db.$executeRawUnsafe(sql)); // `$executeRaw`: as funções devolvem void

  it("sem sessão válida ou sem permissão, nada acontece (incluindo o hash do token)", async () => {
    const alvo = await c.principal("ESTUDANTE");
    const direccao = await c.principal("DIRECCAO");
    const tDir = await abrirSessao(direccao.email);
    const hash = (await dbAdmin.session.findFirstOrThrow({ where: { userId: direccao.id } }))
      .tokenHash;
    for (const tok of ["x".repeat(30), tDir, hash]) {
      const r = await chamar(
        `SELECT definir_papeis('${tok}', '${alvo.id}', ARRAY['DIRECCAO'], NULL)`,
      );
      expect(r, tok.slice(0, 4)).toBe("recusado"); // Direcção não tem utilizadores:gerir; o resto não é sessão
    }
    expect(
      await chamar(
        `SELECT definir_estado_utilizador('${tDir}', '${alvo.id}', 'DESACTIVADO', NULL)`,
      ),
    ).toBe("recusado");
    expect(
      await chamar(
        `SELECT criar_utilizador('${tDir}', 'novo@x.test', 'Novo Nome', 'hash', ARRAY['DOCENTE'], NULL)`,
      ),
    ).toBe("recusado");
    expect(await chamar(`SELECT revogar_sessoes_utilizador('${tDir}', '${alvo.id}', NULL)`)).toBe(
      "recusado",
    );
    expect(
      (
        await dbAdmin.userRole.findMany({ where: { userId: alvo.id }, include: { role: true } })
      ).map((r) => r.role.codigo),
    ).toEqual(["ESTUDANTE"]);
  });

  it("o Admin técnico altera papéis de OUTROS, nunca os seus, com evento de origem BD", async () => {
    const admin = await c.principal("ADMIN_TECNICO");
    const alvo = await c.principal("ESTUDANTE");
    const t = await abrirSessao(admin.email);
    expect(
      await chamar(
        `SELECT definir_papeis('${t}', '${admin.id}', ARRAY['ADMIN_TECNICO','DIRECCAO'], NULL)`,
      ),
    ).toBe("recusado");
    expect(
      await chamar(`SELECT definir_papeis('${t}', '${alvo.id}', ARRAY['PAPEL_INEXISTENTE'], NULL)`),
    ).toBe("recusado");
    expect(await chamar(`SELECT definir_papeis('${t}', '${alvo.id}', ARRAY[]::text[], NULL)`)).toBe(
      "recusado",
    );
    expect(
      await chamar(`SELECT definir_papeis('${t}', '${alvo.id}', ARRAY['DOCENTE'], NULL)`),
    ).toBe("aceite");
    const ev = await dbAdmin.eventoAuditoria.findFirstOrThrow({
      where: { acao: "PAPEIS_ALTERADOS", entidadeId: alvo.id },
    });
    expect(ev.origem).toBe("BD");
    expect(ev.actorId).toBe(admin.id);
  });

  it("sessão expirada ou revogada deixa de autorizar", async () => {
    const admin = await c.principal("ADMIN_TECNICO");
    const alvo = await c.principal("ESTUDANTE");
    const t = await abrirSessao(admin.email);
    await dbAdmin.session.updateMany({
      where: { userId: admin.id },
      data: { ultimaActividade: new Date(Date.now() - 31 * 60_000) },
    });
    expect(
      await chamar(`SELECT definir_estado_utilizador('${t}', '${alvo.id}', 'DESACTIVADO', NULL)`),
    ).toBe("recusado");
    await dbAdmin.session.updateMany({
      where: { userId: admin.id },
      data: { ultimaActividade: new Date(), revogadaEm: new Date() },
    });
    expect(
      await chamar(`SELECT definir_estado_utilizador('${t}', '${alvo.id}', 'DESACTIVADO', NULL)`),
    ).toBe("recusado");
    expect((await dbAdmin.user.findUniqueOrThrow({ where: { id: alvo.id } })).estado).toBe(
      "ACTIVO",
    );
  });
});
