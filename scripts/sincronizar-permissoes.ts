// Sincroniza papéis e permissões (src/server/authz/permissoes.ts) com a base de dados. Corre como DONO no deploy:
// a aplicação (lamanus_app) não pode escrever em Role/Permission/RolePermission (ADR-0008). Idempotente.
import { criarClienteAdmin } from "./db-admin";
import { sincronizarPapeisEPermissoes } from "../src/server/authz/sincronizar";

async function main() {
  const db = criarClienteAdmin();
  try {
    await sincronizarPapeisEPermissoes(db);
    console.log("Papéis e permissões sincronizados.");
  } finally {
    await db.$disconnect();
  }
}
void main();
