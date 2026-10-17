// Catálogo de papéis e permissões. Fonte única — espelha a matriz de docs/security.md §3 (D3 provisória).

export const PAPEIS = [
  "DIRECCAO",
  "SECRETARIA",
  "FINANCEIRO",
  "DOCENTE",
  "RH",
  "QUALIDADE",
  "ESTUDANTE",
  "ENCARREGADO",
  "ADMIN_TECNICO",
] as const;
export type Papel = (typeof PAPEIS)[number];

export const NOMES_PAPEIS: Record<Papel, string> = {
  DIRECCAO: "Direcção",
  SECRETARIA: "Secretaria",
  FINANCEIRO: "Financeiro",
  DOCENTE: "Docente",
  RH: "Recursos Humanos",
  QUALIDADE: "Qualidade",
  ESTUDANTE: "Estudante",
  ENCARREGADO: "Encarregado de Educação",
  ADMIN_TECNICO: "Administrador técnico",
};

export const PERMISSOES = {
  "estrutura:ver": "Ver estrutura escolar",
  "estrutura:editar": "Editar estrutura escolar",
  "estudantes:ver": "Ver estudantes e matrículas",
  "estudantes:editar": "Criar/editar estudantes e matrículas",
  "notas:lancar": "Lançar notas",
  "notas:ver": "Ver notas",
  "notas:corrigir": "Corrigir notas de pautas validadas/publicadas (com motivo)",
  "pauta:publicar": "Validar e publicar pautas",
  "financeiro:ver": "Ver encargos e pagamentos",
  "financeiro:editar": "Registar encargos e pagamentos",
  "estorno:propor": "Propor estornos",
  "estorno:aprovar": "Aprovar estornos",
  "pagamento:confirmar": "Confirmar pagamentos registados (emite o recibo)",
  "declaracoes:pedir": "Pedir declarações",
  "declaracoes:emitir": "Emitir declarações",
  "declaracoes:aprovar": "Aprovar declarações",
  "utilizadores:ver": "Ver utilizadores e papéis",
  "utilizadores:gerir": "Gerir utilizadores e papéis",
  "auditoria:ver": "Ver auditoria",
  "notificacoes:enviar": "Enviar avisos manuais",
  "relatorios:ver": "Ver relatórios (herdam o escopo do recurso)",
} as const;
export type Permissao = keyof typeof PERMISSOES;

export const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  DIRECCAO: [
    "estrutura:editar",
    "estrutura:ver",
    "estudantes:editar",
    "estudantes:ver",
    "notas:ver",
    "notas:corrigir",
    "pauta:publicar",
    "financeiro:ver",
    "estorno:aprovar",
    "pagamento:confirmar",
    "declaracoes:aprovar",
    "utilizadores:ver",
    "auditoria:ver",
    "notificacoes:enviar",
    "relatorios:ver",
  ],
  SECRETARIA: [
    "estrutura:editar",
    "estrutura:ver",
    "estudantes:editar",
    "estudantes:ver",
    "notas:ver",
    "financeiro:ver",
    "declaracoes:emitir",
    "notificacoes:enviar",
    "relatorios:ver",
  ],
  FINANCEIRO: [
    "estrutura:ver",
    "estudantes:ver",
    "financeiro:ver",
    "financeiro:editar",
    "estorno:propor",
    "relatorios:ver",
  ],
  DOCENTE: ["estrutura:ver", "estudantes:ver", "notas:lancar", "notas:ver"],
  RH: [],
  QUALIDADE: ["estrutura:ver", "estudantes:ver", "notas:ver", "auditoria:ver", "relatorios:ver"],
  ESTUDANTE: [
    "estudantes:ver",
    "notas:ver",
    "financeiro:ver",
    "declaracoes:pedir",
    "relatorios:ver",
  ],
  ENCARREGADO: [
    "estudantes:ver",
    "notas:ver",
    "financeiro:ver",
    "declaracoes:pedir",
    "relatorios:ver",
  ],
  ADMIN_TECNICO: [
    "estrutura:editar",
    "estrutura:ver",
    "utilizadores:gerir",
    "utilizadores:ver",
    "auditoria:ver",
  ],
};

export type Area = "interno" | "estudante" | "encarregado";

export const AREA_POR_PAPEL: Record<Papel, Area> = {
  DIRECCAO: "interno",
  SECRETARIA: "interno",
  FINANCEIRO: "interno",
  DOCENTE: "interno",
  RH: "interno",
  QUALIDADE: "interno",
  ADMIN_TECNICO: "interno",
  ESTUDANTE: "estudante",
  ENCARREGADO: "encarregado",
};

export function ehPapel(valor: string): valor is Papel {
  return (PAPEIS as readonly string[]).includes(valor);
}

/**
 * Papéis de negócio vs. administração técnica: o Admin técnico gere contas mas não vê
 * dados académicos/financeiros, e ninguém altera os próprios papéis (separação de funções).
 */
export const PAPEIS_DE_PORTAL: readonly Papel[] = ["ESTUDANTE", "ENCARREGADO"];
