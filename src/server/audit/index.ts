import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

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

export interface EventoAuditoriaInput {
  actorId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  antes?: unknown;
  depois?: unknown;
  ip?: string | null;
}

export async function registarAuditoria(e: EventoAuditoriaInput): Promise<void> {
  await db.eventoAuditoria.create({
    data: {
      actorId: e.actorId ?? null,
      acao: e.acao,
      entidade: e.entidade,
      entidadeId: e.entidadeId ?? null,
      antes: sanitizar(e.antes),
      depois: sanitizar(e.depois),
      ip: e.ip ?? null,
    },
  });
}
