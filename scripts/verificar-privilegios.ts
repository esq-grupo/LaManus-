// Verifica os privilégios REAIS dos papéis da base de dados onde corre a aplicação (ADR-0008). Correr no servidor, depois de cada
// `db:deploy` e antes do go-live:  npm run verificar:privilegios   (usa ADMIN_DATABASE_URL, DATABASE_URL e AUTH_DATABASE_URL)
import pg from "pg";
import { verificarCatalogo, verificarTentativas } from "../src/server/seguranca/privilegios";
import { urlAdmin } from "./db-admin";

async function main() {
  const { DATABASE_URL, AUTH_DATABASE_URL } = process.env;
  if (!DATABASE_URL || !AUTH_DATABASE_URL)
    throw new Error("Defina DATABASE_URL e AUTH_DATABASE_URL (as ligações que a aplicação usa).");
  const admin = new pg.Client({ connectionString: urlAdmin().split("?")[0] });
  await admin.connect();
  let falhas: string[];
  try {
    falhas = await verificarCatalogo(admin);
  } finally {
    await admin.end();
  }
  falhas.push(
    ...(await verificarTentativas(DATABASE_URL, "lamanus_app")),
    ...(await verificarTentativas(AUTH_DATABASE_URL, "lamanus_auth")),
  );
  if (falhas.length > 0) {
    console.error("PRIVILÉGIOS INCORRECTOS:\n- " + falhas.join("\n- "));
    process.exitCode = 1;
    return;
  }
  console.log(
    "Privilégios correctos: a aplicação e o módulo de autenticação têm exactamente o que devem.",
  );
}
void main();
