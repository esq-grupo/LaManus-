/**
 * Procura um valor numérico (nota, em centésimas) como NÚMERO ISOLADO num texto (JSON ou HTML), nunca como pedaço de um
 * identificador. Uma pesquisa por subtexto dá falsos positivos aleatórios: «1777» aparece por acaso dentro de um UUID.
 * Não conta quando o valor está colado a letras, dígitos, «-», «_» ou «,»/«.» seguidos de dígito (parte de outro número).
 */
export function contemValor(texto: string, valor: number | string): boolean {
  const v = String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${v}(?![\\w-])`).test(texto);
}
