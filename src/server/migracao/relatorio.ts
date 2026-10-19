import { formatarKz } from "@/lib/dinheiro";
import type { Plano, Problema } from "@/lib/migracao/tipos";

/** Células que o Excel interpretaria como fórmula levam um apóstrofo à frente (injecção de fórmulas em CSV). */
const seguro = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const csvCelula = (v: string) => `"${seguro(v).replaceAll('"', '""')}"`;

export function relatorioCsv(problemas: Problema[]): string {
  const linhas = ["folha,linha,coluna,valor,tipo,motivo"];
  for (const p of problemas)
    linhas.push(
      [p.folha, String(p.linha), p.coluna, p.valor, p.tipo, p.motivo].map(csvCelula).join(","),
    );
  return linhas.join("\n") + "\n";
}

/** Resumo para a escola assinar: o que entra, o que fica de fora e os totais para reconciliar. Sem dados pessoais. */
export function relatorioMarkdown(
  plano: Plano,
  modo: "ENSAIO" | "APLICADO",
  ficheiro: string,
  sha256: string,
): string {
  const conta = (t: Problema["tipo"]) => plano.problemas.filter((p) => p.tipo === t).length;
  const totalSaldos = plano.saldos.reduce((a, s) => a + s.valorCentimos, 0n);
  const porFolha = new Map<string, number>();
  for (const p of plano.problemas.filter((x) => x.tipo === "REJEITADA"))
    porFolha.set(p.folha, (porFolha.get(p.folha) ?? 0) + 1);
  return [
    `# Relatório de importação — ${modo === "ENSAIO" ? "ENSAIO (nada foi gravado)" : "APLICADO"}`,
    "",
    `Ficheiro: \`${ficheiro}\` · SHA-256: \`${sha256}\``,
    "",
    "## O que entra",
    `- Estudantes: **${plano.estudantes.length}**`,
    `- Encarregados: **${plano.encarregados.length}**`,
    `- Ligações estudante–encarregado: **${plano.ligacoes.length}** (entram **por verificar**: o acesso aos portais é decidido pela Secretaria)`,
    `- Matrículas: **${plano.matriculas.length}**`,
    `- Saldos transitados (encargos de abertura): **${plano.saldos.length}** · total **${formatarKz(totalSaldos)}**`,
    "",
    "## O que fica de fora ou foi alterado",
    `- Linhas **rejeitadas**: **${conta("REJEITADA")}**${[...porFolha].map(([f, n]) => ` (${f}: ${n})`).join("")}`,
    `- Valores **transformados** (ex.: datas DD/MM/AAAA, Kz com separadores): **${conta("TRANSFORMADA")}**`,
    `- Já existiam (ignoradas, repetir não duplica): **${conta("JA_EXISTE")}**`,
    "",
    "As linhas rejeitadas estão no CSV (folha, linha, coluna, valor mascarado, motivo). Corrija o Excel e volte a enviar: só entra o que falta.",
    "",
    "## Reconciliação (a confirmar pela escola)",
    "- [ ] Total de estudantes por turma confere com a lista da escola",
    "- [ ] Soma dos saldos transitados confere com a contabilidade",
    "- [ ] Linhas rejeitadas revistas e decididas",
    "",
  ].join("\n");
}
