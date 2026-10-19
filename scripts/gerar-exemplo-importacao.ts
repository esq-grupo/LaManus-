// Gera um Excel de EXEMPLO (dados fictícios, com erros típicos) para ensaiar o importador:
//   npx tsx scripts/gerar-exemplo-importacao.ts "<ano lectivo>" "<classe>" "<turma>" [saida.xlsx]
import { writeFile } from "node:fs/promises";
import { construirExemplo } from "../src/server/migracao/exemplo";

async function main() {
  const [ano, classe, turma, saida] = process.argv.slice(2);
  if (!ano || !classe || !turma)
    throw new Error('Uso: gerar-exemplo-importacao.ts "<ano>" "<classe>" "<turma>" [saida.xlsx]');
  await writeFile(
    saida ?? "importacao/exemplo-ficticio.xlsx",
    await construirExemplo({ ano, classe, turma }),
  );
  console.log("Exemplo FICTÍCIO criado.");
}
void main();
