/** BI/cédula mascarado por omissão: só os 3 últimos caracteres ficam visíveis. */
export function mascararBi(bi: string | null | undefined): string | null {
  if (!bi) return null;
  return bi.length <= 3 ? "***" : `${"*".repeat(bi.length - 3)}${bi.slice(-3)}`;
}

export const normalizarBi = (bi: string | null | undefined): string | null => {
  const v = (bi ?? "").replace(/\s+/g, "").toUpperCase();
  return v === "" ? null : v;
};
