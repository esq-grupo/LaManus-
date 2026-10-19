import ExcelJS from "exceljs";
import { normalizarTexto } from "@/lib/migracao/validar";
import {
  ALIAS_COLUNAS,
  COLUNAS,
  FOLHAS,
  type Celula,
  type DadosFicheiro,
  type Folha,
  type Linha,
} from "@/lib/migracao/tipos";

export class ErroFicheiro extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroFicheiro";
  }
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LINHAS = 20_000;

function celula(v: ExcelJS.CellValue): Celula {
  if (v == null) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "sim" : "nao";
  const o = v as unknown as Record<string, unknown>;
  if ("result" in o) return celula(o.result as ExcelJS.CellValue); // fórmula: vale o resultado
  if ("richText" in o) return (o.richText as { text: string }[]).map((r) => r.text).join("");
  if ("text" in o) return String(o.text); // hiperligação
  if ("error" in o) return null;
  return null;
}

/** Lê o .xlsx (só folhas conhecidas; cabeçalhos tolerantes a acentos/maiúsculas). Falha de forma clara se faltar uma coluna obrigatória. */
export async function lerFicheiro(buffer: Buffer | Uint8Array): Promise<DadosFicheiro> {
  if (buffer.byteLength > MAX_BYTES)
    throw new ErroFicheiro("Ficheiro demasiado grande (máximo 10 MB).");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new ErroFicheiro("Não foi possível abrir o ficheiro: tem de ser um Excel .xlsx válido.");
  }
  const dados = Object.fromEntries(FOLHAS.map((f) => [f, [] as Linha[]])) as DadosFicheiro;
  for (const folha of FOLHAS) {
    const ws = wb.worksheets.find((w) => normalizarTexto(w.name) === normalizarTexto(folha));
    if (!ws) continue;
    if (ws.rowCount > MAX_LINHAS + 1)
      throw new ErroFicheiro(`A folha «${folha}» tem demasiadas linhas (máximo ${MAX_LINHAS}).`);
    const cab = new Map<number, string>();
    ws.getRow(1).eachCell((c, n) => {
      const nome = normalizarTexto(String(celula(c.value) ?? ""));
      cab.set(n, ALIAS_COLUNAS[nome] ?? nome);
    });
    const { obrigatorias } = COLUNAS[folha as Folha];
    const presentes = new Set(cab.values());
    const faltam = obrigatorias.filter((o) => !presentes.has(o));
    if (faltam.length > 0)
      throw new ErroFicheiro(
        `Folha «${folha}»: faltam as colunas obrigatórias: ${faltam.join(", ")}.`,
      );
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const valores: Record<string, Celula> = {};
      let algum = false;
      for (const [col, nome] of cab) {
        const v = celula(row.getCell(col).value);
        valores[nome] = v;
        if (v !== null && String(v).trim() !== "") algum = true;
      }
      if (algum) dados[folha as Folha].push({ linha: n, valores });
    });
  }
  return dados;
}
