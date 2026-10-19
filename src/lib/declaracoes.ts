import { formatarData } from "@/lib/datas";

// Regras puras das declarações (sem base de dados). Texto em português europeu.

export const TIPOS_DECLARACAO = ["MATRICULA", "FREQUENCIA", "SITUACAO_FINANCEIRA"] as const;
export type TipoDeclaracao = (typeof TIPOS_DECLARACAO)[number];

export const NOMES_DECLARACAO: Record<TipoDeclaracao, string> = {
  MATRICULA: "Declaração de matrícula",
  FREQUENCIA: "Declaração de frequência",
  SITUACAO_FINANCEIRA: "Declaração de situação financeira",
};

/** Instantâneo gravado na emissão (datas como texto AAAA-MM-DD). */
export interface DadosDeclaracao {
  tipo: TipoDeclaracao;
  nome: string;
  numeroProcesso: string;
  dataNascimento: string;
  classe: string;
  turma: string;
  turno: string;
  anoLectivo: string;
}

const d = (s: string) => formatarData(new Date(`${s}T00:00:00.000Z`));

export const TEXTOS_DECLARACAO: Record<TipoDeclaracao, (x: DadosDeclaracao) => string[]> = {
  MATRICULA: (x) => [
    `Declara-se que ${x.nome}, nascido(a) em ${d(x.dataNascimento)}, com o processo n.º ${x.numeroProcesso}, está matriculado(a) neste estabelecimento na ${x.classe}, turma ${x.turma} (${x.turno}), no ano lectivo ${x.anoLectivo}.`,
  ],
  FREQUENCIA: (x) => [
    `Declara-se que ${x.nome}, nascido(a) em ${d(x.dataNascimento)}, com o processo n.º ${x.numeroProcesso}, frequenta este estabelecimento na ${x.classe}, turma ${x.turma} (${x.turno}), no ano lectivo ${x.anoLectivo}.`,
  ],
  SITUACAO_FINANCEIRA: (x) => [
    `Declara-se que ${x.nome}, com o processo n.º ${x.numeroProcesso}, matriculado(a) na ${x.classe}, turma ${x.turma}, no ano lectivo ${x.anoLectivo}, não tem valores em atraso para com este estabelecimento à data de emissão desta declaração.`,
  ],
};

/** Número do documento como aparece no PDF: `D/2026/000007`. */
export function formatarNumeroDocumento(r: { serie: string; ano: number; numero: number }): string {
  return `${r.serie}/${r.ano}/${String(r.numero).padStart(6, "0")}`;
}
