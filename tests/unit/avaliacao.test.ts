import { describe, expect, it } from "vitest";
import {
  dividirArredondando,
  formatarMedia,
  formatarNota,
  mediaPonderada,
  mediaSimples,
  notaParaCentesimas,
} from "@/lib/avaliacao";

describe("notas em centésimas", () => {
  it("converte com vírgula ou ponto e completa casas", () => {
    expect(notaParaCentesimas("14,5")).toBe(1450);
    expect(notaParaCentesimas("14.5")).toBe(1450);
    expect(notaParaCentesimas(14)).toBe(1400);
    expect(notaParaCentesimas("0")).toBe(0);
    expect(notaParaCentesimas("20")).toBe(2000);
    expect(notaParaCentesimas("7,05")).toBe(705);
  });
  it("recusa lixo, negativos, acima de 20 e mais de 2 casas", () => {
    for (const mau of [
      "",
      " ",
      "abc",
      "-1",
      "20,01",
      "21",
      "14,555",
      "1e1",
      "14,5,1",
      "NaN",
      "Infinity",
      "0x10",
      "١٤",
    ]) {
      expect(() => notaParaCentesimas(mau), mau).toThrow(RangeError);
    }
  });
  it("formata sem zeros inúteis", () => {
    expect(formatarNota(1450)).toBe("14,5");
    expect(formatarNota(1400)).toBe("14");
    expect(formatarNota(1425)).toBe("14,25");
    expect(formatarNota(705)).toBe("7,05");
    expect(formatarNota(0)).toBe("0");
  });
});

describe("médias (D4 provisória: ponderada, 1 casa, meio para cima)", () => {
  it("média ponderada simples", () => {
    // (14,5×40 + 16×60) / 100 = 15,4
    expect(
      mediaPonderada([
        { valor: 1450, peso: 40 },
        { valor: 1600, peso: 60 },
      ]),
    ).toBe(154);
  });
  it("arredonda meio para cima (nunca para o par)", () => {
    expect(mediaPonderada([{ valor: 1425, peso: 1 }])).toBe(143); // 14,25 → 14,3
    expect(mediaPonderada([{ valor: 1475, peso: 1 }])).toBe(148); // 14,75 → 14,8
    expect(mediaPonderada([{ valor: 5, peso: 1 }])).toBe(1); // 0,05 → 0,1
    expect(mediaPonderada([{ valor: 4, peso: 1 }])).toBe(0); // 0,04 → 0,0
  });
  it("sem notas não há média; os pesos contam só das avaliações com nota", () => {
    expect(mediaPonderada([])).toBeNull();
    expect(mediaPonderada([{ valor: 1000, peso: 30 }])).toBe(100);
  });
  it("exactidão: valores que dariam erro em vírgula flutuante", () => {
    // 0,1+0,2 em float dá 0,30000000000000004; aqui é exacto
    expect(
      mediaPonderada([
        { valor: 10, peso: 1 },
        { valor: 20, peso: 1 },
      ]),
    ).toBe(2); // 0,15 → 0,2 (meio para cima)
    expect(
      mediaPonderada([
        { valor: 2000, peso: 100 },
        { valor: 2000, peso: 100 },
      ]),
    ).toBe(200);
    expect(mediaPonderada([{ valor: 0, peso: 100 }])).toBe(0);
  });
  it("média geral = média simples das disciplinas", () => {
    expect(mediaSimples([154, 120, 143])).toBe(139); // 417/3 = 139
    expect(mediaSimples([145, 146])).toBe(146); // 145,5 → 146
    expect(mediaSimples([])).toBeNull();
  });
  it("formatação e divisão", () => {
    expect(formatarMedia(143)).toBe("14,3");
    expect(formatarMedia(200)).toBe("20,0");
    expect(formatarMedia(0)).toBe("0,0");
    expect(dividirArredondando(5, 2)).toBe(3);
    expect(() => dividirArredondando(1, 0)).toThrow(RangeError);
  });
});
