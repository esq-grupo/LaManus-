import pg from "pg";

// Verificação dos privilégios REAIS na base de dados (ADR-0008). Serve para confirmar, no servidor onde a aplicação corre,
// que os papéis têm exactamente o que devem — não o que o repositório diz que devia ter (revisão do Codex à H1).
// Duas verificações: (1) consulta o catálogo (has_*_privilege) com a ligação do dono; (2) TENTA, com as ligações restritas
// da aplicação, as operações proibidas dentro de uma transacção que se desfaz sempre.

type Priv = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "TRUNCATE";
const TODAS: Priv[] = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"];

/** Privilégios que cada papel NÃO pode ter, por tabela. */
export const PROIBIDOS: Record<"lamanus_app" | "lamanus_auth", Record<string, Priv[]>> = {
  lamanus_app: {
    Session: TODAS,
    PasswordReset: TODAS,
    TentativaLogin: TODAS,
    User: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    UserRole: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Role: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Permission: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    RolePermission: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    EventoAuditoria: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    LoteMigracao: TODAS,
    Pagamento: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    AlocacaoPagamento: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Estorno: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    EstornoAlocacao: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Recibo: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    SerieRecibo: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    DeclaracaoEmitida: ["UPDATE", "DELETE", "TRUNCATE"],
    Nota: ["TRUNCATE"],
  },
  lamanus_auth: {
    Nota: TODAS,
    Pagamento: TODAS,
    Estudante: TODAS,
    UserRole: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Role: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Permission: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    RolePermission: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    EventoAuditoria: ["INSERT", "UPDATE", "DELETE", "TRUNCATE"],
    Session: ["DELETE", "TRUNCATE"],
    PasswordReset: ["DELETE", "TRUNCATE"],
    TentativaLogin: ["UPDATE", "DELETE", "TRUNCATE"],
  },
};

/** Privilégios que cada papel TEM de ter (senão a aplicação não funciona). */
export const NECESSARIOS: Record<"lamanus_app" | "lamanus_auth", Record<string, Priv[]>> = {
  lamanus_app: {
    Nota: ["SELECT", "INSERT", "UPDATE"],
    Estudante: ["SELECT", "INSERT", "UPDATE"],
    Encargo: ["SELECT", "INSERT"],
    Pagamento: ["SELECT"],
    Notificacao: ["SELECT", "INSERT", "UPDATE"],
    PedidoDeclaracao: ["SELECT", "INSERT", "UPDATE"],
  },
  lamanus_auth: {
    Session: ["SELECT", "INSERT", "UPDATE"],
    User: ["SELECT"],
    PasswordReset: ["SELECT", "INSERT", "UPDATE"],
    TentativaLogin: ["SELECT", "INSERT"],
  },
};

const FUNCOES_APP = [
  "registar_evento_app(uuid,text,text,text,jsonb,jsonb,text)",
  "criar_utilizador(text,text,text,text,text[],text)",
  "definir_papeis(text,uuid,text[],text)",
  "confirmar_pagamento(uuid,text,text)",
  "aprovar_estorno(uuid,text,text,text)",
];
/** Funções internas que NENHUMA ligação restrita pode chamar. */
const FUNCOES_INTERNAS = [
  "autenticar_e_autorizar(text,text)",
  "auditar_conta(uuid,uuid,text,uuid,jsonb,jsonb,text)",
  "auditar_financeiro(uuid,uuid,text,text,uuid,jsonb,jsonb,text)",
];

export async function verificarCatalogo(admin: pg.Client): Promise<string[]> {
  const falhas: string[] = [];
  for (const papel of ["lamanus_app", "lamanus_auth"] as const) {
    const existe = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [papel]);
    if (existe.rowCount === 0) {
      falhas.push(`O papel ${papel} não existe (docker/db/papeis.sql).`);
      continue;
    }
    const super_ = await admin.query(
      "SELECT rolsuper OR rolcreaterole OR rolcreatedb AS poderoso, rolbypassrls FROM pg_roles WHERE rolname = $1",
      [papel],
    );
    if (super_.rows[0].poderoso || super_.rows[0].rolbypassrls)
      falhas.push(`${papel} tem poderes de superutilizador/criação/BYPASSRLS.`);
    for (const [tabela, privs] of Object.entries(PROIBIDOS[papel]))
      for (const p of privs) {
        const r = await admin.query(
          `SELECT has_table_privilege($1, format('public.%I', $2::text), $3) AS tem`,
          [papel, tabela, p],
        );
        if (r.rows[0].tem) falhas.push(`${papel} tem ${p} em "${tabela}" (proibido).`);
      }
    for (const [tabela, privs] of Object.entries(NECESSARIOS[papel]))
      for (const p of privs) {
        const r = await admin.query(
          `SELECT has_table_privilege($1, format('public.%I', $2::text), $3) AS tem`,
          [papel, tabela, p],
        );
        if (!r.rows[0].tem) falhas.push(`${papel} não tem ${p} em "${tabela}" (necessário).`);
      }
    for (const fn of FUNCOES_INTERNAS) {
      const r = await admin.query(
        `SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE') AS tem`,
        [papel, fn],
      );
      if (r.rows[0].tem) falhas.push(`${papel} pode executar ${fn} (função interna).`);
    }
  }
  const hash = await admin.query(
    `SELECT has_column_privilege('lamanus_app', 'public."User"', 'passwordHash', 'SELECT') AS tem`,
  );
  if (hash.rows[0].tem) falhas.push(`lamanus_app lê "User"."passwordHash" (proibido).`);
  for (const fn of FUNCOES_APP) {
    const r = await admin.query(
      `SELECT has_function_privilege('lamanus_app', $1::regprocedure, 'EXECUTE') AS tem`,
      [fn],
    );
    if (!r.rows[0].tem) falhas.push(`lamanus_app não pode executar ${fn} (necessário).`);
  }
  return falhas;
}

/** Tenta, com a ligação restrita, operações que TÊM de falhar (tudo dentro de uma transacção desfeita). */
export async function verificarTentativas(
  url: string,
  papel: "lamanus_app" | "lamanus_auth",
): Promise<string[]> {
  const proibido: Record<typeof papel, string[]> = {
    lamanus_app: [
      `SELECT count(*) FROM "Session"`,
      `UPDATE "Session" SET "expiraEm" = now() WHERE false`,
      `SELECT "passwordHash" FROM "User" LIMIT 1`,
      `UPDATE "User" SET estado = 'ACTIVO'`,
      `DELETE FROM "UserRole"`,
      `DELETE FROM "RolePermission"`,
      `INSERT INTO "EventoAuditoria" (id, acao, entidade) VALUES (gen_random_uuid(), 'VERIFICACAO', 'X')`,
      `TRUNCATE "Nota"`,
      `SET ROLE lamanus`,
    ],
    lamanus_auth: [
      `SELECT count(*) FROM "Nota"`,
      `DELETE FROM "Session"`,
      `DELETE FROM "UserRole"`,
      `INSERT INTO "EventoAuditoria" (id, acao, entidade) VALUES (gen_random_uuid(), 'VERIFICACAO', 'X')`,
    ],
  };
  const falhas: string[] = [];
  const c = new pg.Client({ connectionString: url.split("?")[0] });
  await c.connect();
  try {
    const quem = await c.query("SELECT current_user AS u");
    if (quem.rows[0].u !== papel)
      falhas.push(`A ligação de ${papel} está a usar o papel «${quem.rows[0].u}».`);
    for (const sql of proibido[papel]) {
      await c.query("BEGIN");
      try {
        await c.query(sql);
        falhas.push(`${papel} conseguiu executar: ${sql}`);
      } catch {
        /* recusado: correcto */
      } finally {
        await c.query("ROLLBACK");
      }
    }
  } finally {
    await c.end();
  }
  return falhas;
}
