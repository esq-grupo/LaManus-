import type { Prisma } from "@/generated/prisma/client";
import { hojeEmLuanda } from "@/lib/datas";
import { can, type Principal } from "./index";

/**
 * Escopo de dados: devolve o filtro Prisma (`where`) que limita os registos visíveis.
 * Nunca se usa um ID vindo do browser para decidir o que o utilizador vê: o filtro parte da sessão.
 *
 * Regra de segurança: se não houver regra explícita, o escopo é VAZIO (nega tudo).
 */
export type FiltroEstudantes = Prisma.EstudanteWhereInput;

const NADA: FiltroEstudantes = { id: { in: [] } };

export function escopoEstudantes(principal: Principal, agora: Date = new Date()): FiltroEstudantes {
  if (!can(principal, "estudantes:ver")) return NADA;
  const papeis = new Set(principal.papeis);
  const filtros: FiltroEstudantes[] = [];

  // Pessoal de gestão com permissão de leitura: todos os estudantes.
  if (
    papeis.has("DIRECCAO") ||
    papeis.has("SECRETARIA") ||
    papeis.has("FINANCEIRO") ||
    papeis.has("QUALIDADE")
  ) {
    return {};
  }

  // Estudante: só o próprio registo (ligado à sua conta).
  if (papeis.has("ESTUDANTE")) filtros.push({ userId: principal.id });

  // Docente: só estudantes com matrícula ACTIVA em turmas onde lecciona alguma disciplina.
  if (papeis.has("DOCENTE")) {
    filtros.push({
      matriculas: {
        some: {
          estado: "ACTIVA",
          turma: { disciplinas: { some: { docente: { userId: principal.id } } } },
        },
      },
    });
  }

  // Encarregado: só educandos com ligação verificada E autorização activa, dentro da validade.
  if (papeis.has("ENCARREGADO")) {
    const d = hojeEmLuanda(agora);
    filtros.push({
      encarregados: {
        some: {
          verificado: true,
          autorizacaoActiva: true,
          encarregado: { userId: principal.id, archivedAt: null },
          AND: [
            { OR: [{ validoDe: null }, { validoDe: { lte: d } }] },
            { OR: [{ validoAte: null }, { validoAte: { gte: d } }] },
          ],
        },
      },
    });
  }

  if (filtros.length === 0) return NADA;
  return filtros.length === 1 ? filtros[0]! : { OR: filtros };
}

// ── Estrutura escolar (turmas) ───────────────────────────────────────────────

const PAPEIS_ESTRUTURA_COMPLETA = [
  "DIRECCAO",
  "SECRETARIA",
  "FINANCEIRO",
  "QUALIDADE",
  "ADMIN_TECNICO",
] as const;

/** Quem vê a estrutura de TODAS as turmas (matriz: Direcção, Secretaria, Financeiro, Qualidade, Admin técnico). */
export function veEstruturaCompleta(principal: Principal): boolean {
  return (
    can(principal, "estrutura:ver") &&
    principal.papeis.some((p) => (PAPEIS_ESTRUTURA_COMPLETA as readonly string[]).includes(p))
  );
}

/**
 * Escopo de turmas. Os papéis de gestão veem todas; o Docente só as turmas onde lecciona alguma disciplina
 * (matriz: «👁 suas turmas»); sem regra explícita → nada. Quem acumula papéis fica com a união (vê tudo se algum o permitir).
 */
export function escopoTurmas(principal: Principal): Prisma.TurmaWhereInput {
  if (!can(principal, "estrutura:ver")) return { id: { in: [] } };
  if (veEstruturaCompleta(principal)) return {};
  if (principal.papeis.includes("DOCENTE")) {
    return { disciplinas: { some: { docente: { userId: principal.id } } } };
  }
  return { id: { in: [] } };
}
