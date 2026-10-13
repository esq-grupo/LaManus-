import type { Principal } from "./index";
import { can } from "./index";

/**
 * Escopo de dados: devolve o filtro Prisma (`where`) que limita os registos visíveis.
 * Nunca se usa um ID vindo do browser para decidir o que o utilizador vê: o filtro parte da sessão.
 *
 * Regra de segurança: se não houver regra explícita, o escopo é VAZIO (nega tudo).
 */
export type FiltroEstudantes =
  { userId: string } | { id: { in: string[] } } | Record<string, never>;

const NADA: FiltroEstudantes = { id: { in: [] } };

export function escopoEstudantes(principal: Principal): FiltroEstudantes {
  if (!can(principal, "estudantes:ver")) return NADA;
  const p = new Set(principal.papeis);
  // Pessoal de gestão com permissão de leitura: todos os estudantes.
  if (p.has("DIRECCAO") || p.has("SECRETARIA") || p.has("FINANCEIRO") || p.has("QUALIDADE"))
    return {};
  // Estudante: só o próprio registo (ligado à sua conta).
  if (p.has("ESTUDANTE")) return { userId: principal.id };
  // Docente (suas turmas) e Encarregado (educandos verificados) dependem de entidades da Entrega C:
  // até existirem, o escopo é vazio de propósito.
  return NADA;
}
