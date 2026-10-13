import type { Prisma } from "@/generated/prisma/client";
import { can, type Principal } from "./index";

/**
 * Escopo de dados: devolve o filtro Prisma (`where`) que limita os registos visíveis.
 * Nunca se usa um ID vindo do browser para decidir o que o utilizador vê: o filtro parte da sessão.
 *
 * Regra de segurança: se não houver regra explícita, o escopo é VAZIO (nega tudo).
 */
export type FiltroEstudantes = Prisma.EstudanteWhereInput;

const NADA: FiltroEstudantes = { id: { in: [] } };

/** Hoje como data (00:00 UTC) para comparar com colunas `@db.Date`. */
const hoje = (agora: Date) =>
  new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));

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
    const d = hoje(agora);
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
