import {
  AREA_POR_PAPEL,
  PERMISSOES_POR_PAPEL,
  type Area,
  type Papel,
  type Permissao,
} from "./permissoes";

export * from "./permissoes";

/** O mínimo que a camada authz precisa de saber de um utilizador autenticado. */
export interface Principal {
  id: string;
  papeis: readonly Papel[];
}

/** Permissões efectivas = união das permissões dos papéis. Sem papéis → nenhuma (negar por omissão). */
export function permissoesDe(principal: Principal): ReadonlySet<Permissao> {
  const conjunto = new Set<Permissao>();
  for (const papel of principal.papeis) {
    for (const p of PERMISSOES_POR_PAPEL[papel] ?? []) conjunto.add(p);
  }
  return conjunto;
}

export function can(principal: Principal | null | undefined, permissao: Permissao): boolean {
  if (!principal) return false;
  return permissoesDe(principal).has(permissao);
}

/** Áreas a que o utilizador pode aceder (pelo menos uma por papel). */
export function areasDe(principal: Principal | null | undefined): ReadonlySet<Area> {
  return new Set((principal?.papeis ?? []).map((p) => AREA_POR_PAPEL[p]).filter(Boolean));
}

export function podeAceder(principal: Principal | null | undefined, area: Area): boolean {
  return areasDe(principal).has(area);
}

/** Área inicial para onde enviar o utilizador depois do login. */
export function areaInicial(principal: Principal): Area | null {
  const areas = areasDe(principal);
  for (const a of ["interno", "estudante", "encarregado"] as const) if (areas.has(a)) return a;
  return null;
}

/**
 * Regra de separação de funções na gestão de papéis:
 *  - ninguém altera os próprios papéis;
 *  - só quem tem `utilizadores:gerir` altera papéis de outros.
 */
export function podeAlterarPapeis(actor: Principal, alvoId: string): boolean {
  return can(actor, "utilizadores:gerir") && actor.id !== alvoId;
}
