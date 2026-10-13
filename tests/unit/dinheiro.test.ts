import { describe, expect, it } from "vitest";
import { centimosParaKz, formatarKz, kzParaCentimos } from "@/lib/dinheiro";

describe("dinheiro", () => {
  it("converte 15 000 Kz para 1 500 000 cêntimos e vice-versa", () => {
    expect(kzParaCentimos(15000)).toBe(1_500_000n);
    expect(centimosParaKz(1_500_000n)).toBe(15000n);
  });
  it("suporta valores acima de 21 milhões de Kz (limite de Int32 em cêntimos)", () => {
    expect(kzParaCentimos(50_000_000)).toBe(5_000_000_000n);
  });
  it("rejeita decimais em Kz", () => {
    expect(() => kzParaCentimos(10.5)).toThrow(RangeError);
  });
  it("rejeita cêntimos que não são Kz inteiros", () => {
    expect(() => centimosParaKz(1050n)).toThrow(RangeError);
  });
  it("formata com separador de milhares", () => {
    expect(formatarKz(1_500_000n)).toBe("15 000 Kz");
    expect(formatarKz(0n)).toBe("0 Kz");
  });
});
