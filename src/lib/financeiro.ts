// Regras puras do financeiro (sem base de dados). Valores em cêntimos (BigInt); datas de vencimento como `@db.Date` (00:00 UTC).

export type EstadoEncargo = "ANULADO" | "PAGO" | "PARCIAL" | "VENCIDO" | "PENDENTE";

/**
 * Estado calculado de um encargo. `hoje` é o dia em Africa/Luanda (ver `hojeEmLuanda`): um encargo só está VENCIDO
 * depois do dia de vencimento. Um encargo parcialmente pago e vencido continua VENCIDO (a dívida em atraso prevalece).
 */
export function estadoEncargo(
  e: { valor: bigint; pago: bigint; vencimento: Date; anulado: boolean },
  hoje: Date,
): EstadoEncargo {
  if (e.anulado) return "ANULADO";
  if (e.pago >= e.valor) return "PAGO";
  if (e.vencimento.getTime() < hoje.getTime()) return "VENCIDO";
  return e.pago > 0n ? "PARCIAL" : "PENDENTE";
}

/** Referência mensal `AAAA-MM`. */
export function referenciaMensal(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Número do recibo como aparece no documento: `R/2026/000012`. */
export function formatarNumeroRecibo(r: { serie: string; ano: number; numero: number }): string {
  return `${r.serie}/${r.ano}/${String(r.numero).padStart(6, "0")}`;
}

/** Meses `AAAA-MM` (inclusive) entre duas datas de um ano lectivo. */
export function mesesEntre(inicio: Date, fim: Date): string[] {
  const out: string[] = [];
  let a = inicio.getUTCFullYear();
  let m = inicio.getUTCMonth() + 1;
  const af = fim.getUTCFullYear();
  const mf = fim.getUTCMonth() + 1;
  while (a < af || (a === af && m <= mf)) {
    out.push(referenciaMensal(a, m));
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return out;
}
