import { z } from "zod";

/** Data `AAAA-MM-DD` (como vem de <input type="date">) → Date em UTC (coluna `@db.Date`). */
export const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .transform((v, ctx) => {
    const d = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return d;
  });

export function formatarData(d: Date | null | undefined): string {
  if (!d) return "—";
  const [a, m, dia] = d.toISOString().slice(0, 10).split("-");
  return `${dia}/${m}/${a}`;
}

const FUSO_ESCOLA = "Africa/Luanda";
const formatoLuanda = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_ESCOLA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * A data de HOJE em Africa/Luanda (00:00 UTC desse dia, para comparar com colunas `@db.Date`).
 * Nunca depende do fuso horário do servidor: validade de autorizações e "data futura" usam sempre o dia da escola.
 */
export function hojeEmLuanda(agora: Date = new Date()): Date {
  return new Date(`${formatoLuanda.format(agora)}T00:00:00.000Z`);
}
