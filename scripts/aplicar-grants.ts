// Aplica prisma/grants.sql como DONO. Correr depois de cada `migrate deploy` (npm run db:grants / db:deploy).
import { readFile } from "node:fs/promises";
import pg from "pg";
import { urlAdmin } from "./db-admin";

async function main() {
  const cliente = new pg.Client({ connectionString: urlAdmin() });
  await cliente.connect();
  try {
    const existe = await cliente.query("SELECT 1 FROM pg_roles WHERE rolname = 'lamanus_app'");
    if (existe.rowCount === 0) {
      console.warn(
        "Aviso: o papel lamanus_app não existe (docker/db/papeis.sql); a aplicação correrá com o papel de ligação actual.",
      );
      return;
    }
    const db = (await cliente.query("SELECT current_database() AS d")).rows[0].d as string;
    const sql = (await readFile("prisma/grants.sql", "utf8")).replaceAll(
      ':"db"',
      `"${db.replaceAll('"', '""')}"`,
    );
    await cliente.query(sql);
    console.log("Privilégios do papel lamanus_app aplicados.");
  } finally {
    await cliente.end();
  }
}

void main();
