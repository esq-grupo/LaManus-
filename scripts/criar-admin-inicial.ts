// Cria a PRIMEIRA conta de Administrador técnico num sistema novo (staging/produção), onde o seed está proibido.
//   npm run admin:inicial -- <email> "<Nome completo>"
// A conta nasce com palavra-passe inutilizável; o script imprime UM link de definição de palavra-passe (30 minutos, uso único).
// Corre como DONO da BD. Recusa se já existir um Administrador técnico. Depois os restantes utilizadores criam-se na aplicação.
import { randomBytes } from "node:crypto";
import { criarClienteAdmin } from "./db-admin";
import { AUTH } from "../src/server/auth/config";
import { hashPassword } from "../src/server/auth/password";
import { gerarToken } from "../src/server/auth/tokens";

async function main() {
  const [emailBruto, nome] = process.argv.slice(2);
  const email = (emailBruto ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (nome ?? "").trim().length < 3)
    throw new Error('Uso: npm run admin:inicial -- <email> "<Nome completo>"');
  const db = criarClienteAdmin();
  try {
    const role = await db.role.findUnique({ where: { codigo: "ADMIN_TECNICO" } });
    if (!role) throw new Error("Os papéis ainda não existem: corra `npm run db:deploy` primeiro.");
    if ((await db.userRole.count({ where: { roleId: role.id } })) > 0)
      throw new Error(
        "Já existe um Administrador técnico. Use a aplicação para criar mais utilizadores.",
      );
    const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
    const { token, tokenHash } = gerarToken();
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          nome: nome!.trim(),
          passwordHash,
          papeis: { create: [{ roleId: role.id }] },
        },
      });
      await tx.passwordReset.create({
        data: { userId: u.id, tokenHash, expiraEm: new Date(Date.now() + AUTH.resetValidadeMs) },
      });
      await tx.eventoAuditoria.create({
        data: {
          acao: "ADMIN_INICIAL_CRIADO",
          entidade: "User",
          entidadeId: u.id,
          depois: { email },
        },
      });
      return u;
    });
    const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    console.log(`Administrador técnico criado: ${user.email}`);
    console.log(
      "Defina a palavra-passe NOS PRÓXIMOS 30 MINUTOS (link de uso único; não o partilhe nem o guarde):",
    );
    console.log(`${base}/redefinir/${token}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
