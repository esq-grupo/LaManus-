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
