// Dinheiro: apresentação em Kz inteiros; armazenamento em cêntimos (BigInt). Ver docs/data-model.md §2.1.
// Este é o ÚNICO sítio onde se multiplica/divide por 100.
const CENTIMOS_POR_KZ = 100n;

export function kzParaCentimos(kz: number | bigint): bigint {
  if (typeof kz === "number" && !Number.isSafeInteger(kz)) {
    throw new RangeError("Valor em Kz tem de ser um número inteiro");
  }
  return BigInt(kz) * CENTIMOS_POR_KZ;
}

export function centimosParaKz(centimos: bigint): bigint {
  if (centimos % CENTIMOS_POR_KZ !== 0n) {
    throw new RangeError("Valor em cêntimos não corresponde a Kz inteiros");
  }
  return centimos / CENTIMOS_POR_KZ;
}

export function formatarKz(centimos: bigint): string {
  const kz = centimosParaKz(centimos);
  const sinal = kz < 0n ? "-" : "";
  const abs = (kz < 0n ? -kz : kz).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sinal}${abs} Kz`;
}
