// Importação de dados (Entrega H): tipos partilhados. Tudo aqui é puro (sem base de dados).

export type Celula = string | number | Date | null;
export type Linha = { linha: number; valores: Record<string, Celula> };

export const FOLHAS = ["Estudantes", "Encarregados", "Ligacoes", "Matriculas", "Saldos"] as const;
export type Folha = (typeof FOLHAS)[number];
export type DadosFicheiro = Record<Folha, Linha[]>;

/** Colunas aceites por folha (nomes normalizados: sem acentos, minúsculas, sem espaços). `*` = obrigatória. */
export const COLUNAS: Record<Folha, { obrigatorias: string[]; opcionais: string[] }> = {
  Estudantes: {
    obrigatorias: ["numeroprocesso", "nome", "datanascimento"],
    opcionais: ["bi", "contacto"],
  },
  Encarregados: { obrigatorias: ["bi", "nome"], opcionais: ["contacto"] },
  Ligacoes: {
    obrigatorias: ["numeroprocesso", "biencarregado", "parentesco"],
    opcionais: ["principal"],
  },
  Matriculas: {
    obrigatorias: ["numeroprocesso", "anolectivo", "classe", "turma", "tipo"],
    opcionais: [],
  },
  Saldos: {
    obrigatorias: ["numeroprocesso", "anolectivo", "valorkz", "vencimento"],
    opcionais: ["descricao"],
  },
};

export type TipoProblema = "REJEITADA" | "TRANSFORMADA" | "JA_EXISTE";
export interface Problema {
  folha: Folha;
  linha: number;
  coluna: string;
  /** Valor já MASCARADO (nunca dados pessoais completos em relatórios). */
  valor: string;
  motivo: string;
  tipo: TipoProblema;
}

export interface EstudanteNovo {
  linha: number;
  numeroProcesso: string;
  nome: string;
  dataNascimento: string; // AAAA-MM-DD
  bi: string | null;
  contacto: string | null;
}
export interface EncarregadoNovo {
  linha: number;
  bi: string;
  nome: string;
  contacto: string | null;
}
export interface LigacaoNova {
  linha: number;
  numeroProcesso: string;
  bi: string;
  parentesco: string;
  principal: boolean;
}
export interface MatriculaNova {
  linha: number;
  numeroProcesso: string;
  turmaId: string;
  anoLectivoId: string;
  tipo: "NOVA" | "RENOVACAO";
}
export interface SaldoNovo {
  linha: number;
  numeroProcesso: string;
  anoLectivoId: string;
  valorCentimos: bigint;
  vencimento: string; // AAAA-MM-DD
  descricao: string;
}

export interface Plano {
  estudantes: EstudanteNovo[];
  encarregados: EncarregadoNovo[];
  ligacoes: LigacaoNova[];
  matriculas: MatriculaNova[];
  saldos: SaldoNovo[];
  problemas: Problema[];
}

/** O que já existe na base de dados (carregado pelo chamador): serve para idempotência e conflitos. */
export interface Contexto {
  hoje: Date;
  estudantes: Map<string, { nome: string; dataNascimento: string; bi: string | null }>; // por n.º de processo
  biDeEstudantes: Map<string, string>; // bi → n.º de processo
  encarregados: Map<string, { nome: string }>; // por BI
  ligacoes: Set<string>; // `${numeroProcesso}|${bi}`
  matriculas: { numeroProcesso: string; anoLectivoId: string; tipo: string; estado: string }[];
  /** `${ano}|${classe}|${turma}` normalizados → ids. */
  turmas: Map<string, { turmaId: string; anoLectivoId: string }>;
  anos: Map<string, string>; // nome normalizado → id
  saldosExistentes: Set<string>; // `${numeroProcesso}|${anoLectivoId}`
}

/** Nomes alternativos aceites nos cabeçalhos (já normalizados) → nome canónico. */
export const ALIAS_COLUNAS: Record<string, string> = {
  nprocesso: "numeroprocesso",
  noprocesso: "numeroprocesso",
  numprocesso: "numeroprocesso",
  nrprocesso: "numeroprocesso",
  processo: "numeroprocesso",
  numerodeprocesso: "numeroprocesso",
  datadenascimento: "datanascimento",
  nascimento: "datanascimento",
  dtnascimento: "datanascimento",
  ano: "anolectivo",
  anoletivo: "anolectivo",
  anoescolar: "anolectivo",
  valor: "valorkz",
  kz: "valorkz",
  bidoencarregado: "biencarregado",
  biencarregado: "biencarregado",
};
