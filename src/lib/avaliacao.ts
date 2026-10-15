// Fórmula de notas (D4 — PROVISÓRIA, a confirmar com a escola):
//   escala 0–20 · média ponderada pelos pesos · 1 casa decimal · arredondamento «meio para cima».
// Tudo em inteiros: notas em CENTÉSIMAS (14,5 → 1450) e médias em DÉCIMAS (14,3 → 143). Nunca se usa vírgula flutuante.

export const CONFIG_AVALIACAO = {
  escalaMaxima: 20,
  casasDecimaisNota: 2,
  casasDecimaisMedia: 1,
  arredondamento: "meio-para-cima",
} as const;

export const NOTA_MAX_CENTESIMAS = CONFIG_AVALIACAO.escalaMaxima * 100;

/** Divisão inteira com arredondamento «meio para cima» (só para positivos). */
export function dividirArredondando(numerador: number, denominador: number): number {
  if (denominador <= 0) throw new RangeError("Denominador inválido");
  return Math.floor((2 * numerador + denominador) / (2 * denominador));
}

/** "14,5" / "14.5" / 14.5 → 1450. Recusa vazio, negativos, > 20, mais de 2 casas decimais ou lixo. */
export function notaParaCentesimas(entrada: string | number): number {
  const texto = String(entrada).trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(texto))
    throw new RangeError("Nota inválida: use um valor de 0 a 20 (até 2 casas decimais).");
  const [inteira, decimal = ""] = texto.split(".");
  const centesimas = Number(inteira) * 100 + Number(decimal.padEnd(2, "0"));
  if (centesimas > NOTA_MAX_CENTESIMAS) throw new RangeError("A nota não pode ser superior a 20.");
  return centesimas;
}

/** 1450 → "14,5"; 1400 → "14"; 1425 → "14,25". */
export function formatarNota(centesimas: number): string {
  const inteira = Math.floor(centesimas / 100);
  const resto = centesimas % 100;
  if (resto === 0) return String(inteira);
  return `${inteira},${String(resto).padStart(2, "0").replace(/0$/, "")}`;
}

/** 143 → "14,3". */
export function formatarMedia(decimas: number): string {
  return `${Math.floor(decimas / 10)},${decimas % 10}`;
}

export interface ItemMedia {
  valor: number; // centésimas
  peso: number; // inteiro > 0
}

/**
 * Média ponderada em DÉCIMAS (ou null sem itens): round_half_up( Σ(valor×peso) / (10 × Σpeso) ).
 * Só entram as avaliações que têm nota.
 */
export function mediaPonderada(itens: readonly ItemMedia[]): number | null {
  if (itens.length === 0) return null;
  const somaPesos = itens.reduce((a, i) => a + i.peso, 0);
  if (somaPesos <= 0) return null;
  const somaPonderada = itens.reduce((a, i) => a + i.valor * i.peso, 0);
  return dividirArredondando(somaPonderada, 10 * somaPesos);
}

/** Média simples de médias em décimas (média geral do período = média das disciplinas), arredondada à décima. */
export function mediaSimples(decimas: readonly number[]): number | null {
  if (decimas.length === 0) return null;
  return dividirArredondando(
    decimas.reduce((a, d) => a + d, 0),
    decimas.length,
  );
}
