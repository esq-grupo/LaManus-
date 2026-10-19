// Importação de dados a partir de um Excel (.xlsx) — ADMINISTRAÇÃO, fora da aplicação web. Ver docs/migration-excel.md.
//   npm run importar -- <ficheiro.xlsx> [--relatorio <pasta>]                       → ENSAIO: valida e escreve o relatório, NÃO grava
//   CONFIRMO_IMPORTACAO=SIM npm run importar -- <ficheiro.xlsx> --aplicar          → grava (só as linhas válidas)
//   CONFIRMO_IMPORTACAO=SIM npm run importar -- --reverter <idDoLote>              → anula o que o lote criou
// Dados reais: só em ambiente seguro, com autorização do PO; relatórios e ficheiros ficam FORA do Git (ver .gitignore).
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validarFicheiro } from "../src/lib/migracao/validar";
import { aplicarPlano, carregarContexto, reverterLote } from "../src/server/migracao/aplicar";
import { ErroFicheiro, lerFicheiro } from "../src/server/migracao/ler";
import { relatorioCsv, relatorioMarkdown } from "../src/server/migracao/relatorio";
import { criarClienteAdmin } from "./db-admin";

async function main() {
  const args = process.argv.slice(2);
  const flag = (n: string) => args.includes(n);
  const valor = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const db = criarClienteAdmin();
  try {
    const bd = (
      (await db.$queryRaw<{ d: string }[]>`SELECT current_database() AS d`)[0] ?? { d: "?" }
    ).d;
    console.log(`Base de dados: ${bd}`);
    const confirmado = process.env.CONFIRMO_IMPORTACAO === "SIM";

    if (flag("--reverter")) {
      if (!confirmado)
        throw new Error(
          "Para reverter defina CONFIRMO_IMPORTACAO=SIM (confirme que a base de dados acima é a certa).",
        );
      await reverterLote(db, String(valor("--reverter")));
      console.log("Lote revertido.");
      return;
    }

    const ficheiro = args.find((a) => !a.startsWith("--") && a !== valor("--relatorio"));
    if (!ficheiro) throw new Error("Indique o ficheiro .xlsx.");
    const aplicar = flag("--aplicar");
    if (aplicar && !confirmado)
      throw new Error(
        "Para gravar defina CONFIRMO_IMPORTACAO=SIM (confirme que a base de dados acima é a certa).",
      );

    const buffer = await readFile(ficheiro);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const dados = await lerFicheiro(buffer);
    const plano = validarFicheiro(dados, await carregarContexto(db));
    const pasta = valor("--relatorio") ?? "importacao/relatorios";
    await mkdir(pasta, { recursive: true });
    const base = path.join(
      pasta,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${sha256.slice(0, 8)}`,
    );

    let modo: "ENSAIO" | "APLICADO" = "ENSAIO";
    if (aplicar) {
      const r = await aplicarPlano(db, plano, { ficheiro: path.basename(ficheiro), sha256 });
      modo = "APLICADO";
      console.log(`Lote ${r.lote.id} aplicado (guarde este número para poder reverter).`);
    }
    await writeFile(`${base}.csv`, relatorioCsv(plano.problemas), "utf8");
    await writeFile(
      `${base}.md`,
      relatorioMarkdown(plano, modo, path.basename(ficheiro), sha256),
      "utf8",
    );
    console.log(
      `${modo}: estudantes ${plano.estudantes.length}, encarregados ${plano.encarregados.length}, ligações ${plano.ligacoes.length}, ` +
        `matrículas ${plano.matriculas.length}, saldos ${plano.saldos.length}; rejeitadas ${plano.problemas.filter((p) => p.tipo === "REJEITADA").length}.`,
    );
    console.log(`Relatório: ${base}.md e ${base}.csv`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof ErroFicheiro ? `Ficheiro inválido: ${e.message}` : e);
  process.exitCode = 1;
});
