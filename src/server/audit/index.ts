import { db } from "@/server/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

// Nunca guardar segredos em eventos de auditoria.
const CHAVES_PROIBIDAS = /pass|hash|token|secret|segredo/i;

export function sanitizar(valor: unknown): Prisma.InputJsonValue | undefined {
  if (valor === undefined || valor === null) return undefined;
  const limpar = (v: unknown): Prisma.InputJsonValue => {
    if (Array.isArray(v)) return v.map(limpar);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, x]) => [
          k,
          CHAVES_PROIBIDAS.test(k) ? "[omitido]" : limpar(x),
        ]),
      );
    }
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    return (v ?? null) as Prisma.InputJsonValue;
  };
  return limpar(valor);
}

function jsonOuNulo(v: unknown): string | null {
  const limpo = sanitizar(v);
  return limpo === undefined ? null : JSON.stringify(limpo);
}

export interface EventoAuditoriaInput {
  actorId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  ip?: string | null;
}

/** Cliente mínimo necessário: aceita o `db` normal ou o cliente de uma transacção (`tx`). */
export type ClienteAuditoria = Pick<PrismaClient, "$executeRaw">;

/**
 * Regista o evento. Para alterações críticas passe o `tx` da transacção que faz a alteração: assim a alteração e
 * a auditoria gravam-se JUNTAS ou não se grava nenhuma (nunca fica uma alteração sem rasto).
 */
export async function registarAuditoria(
  e: EventoAuditoriaInput,
  cliente: ClienteAuditoria = db,
): Promise<void> {
  // Só por esta função da BD (hora e origem fixadas pelo servidor): a aplicação não tem INSERT directo na auditoria (ADR-0008).
  await cliente.$executeRaw`SELECT registar_evento_app(${e.actorId ?? null}::uuid, ${e.acao}, ${e.entidade}, ${e.entidadeId ?? null}, ${jsonOuNulo(e.antes)}::jsonb, ${jsonOuNulo(e.depois)}::jsonb, ${e.ip ?? null})`;
}

/**
 * Executa uma alteração e a sua auditoria na MESMA transacção: ou ficam as duas gravadas, ou nenhuma.
 * `fn` recebe o cliente da transacção e devolve o resultado e o evento a registar.
 */
export async function comAuditoria<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<{ resultado: T; evento: EventoAuditoriaInput }>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    const { resultado, evento } = await fn(tx);
    await registarAuditoria(evento, tx);
    return resultado;
  });
}
