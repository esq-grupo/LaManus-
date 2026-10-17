import { describe, expect, it } from "vitest";
import {
  estadoEncargo,
  formatarNumeroRecibo,
  mesesEntre,
  referenciaMensal,
} from "@/lib/financeiro";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("estadoEncargo", () => {
  const base = { valor: 100n, pago: 0n, vencimento: d("2026-10-05"), anulado: false };
  it("pendente até ao dia de vencimento (inclusive)", () => {
    expect(estadoEncargo(base, d("2026-10-05"))).toBe("PENDENTE");
  });
  it("vencido no dia seguinte", () => {
    expect(estadoEncargo(base, d("2026-10-06"))).toBe("VENCIDO");
  });
  it("parcial antes do vencimento; vencido (não parcial) depois", () => {
    expect(estadoEncargo({ ...base, pago: 40n }, d("2026-10-01"))).toBe("PARCIAL");
    expect(estadoEncargo({ ...base, pago: 40n }, d("2026-11-01"))).toBe("VENCIDO");
  });
  it("pago e anulado têm prioridade", () => {
    expect(estadoEncargo({ ...base, pago: 100n }, d("2027-01-01"))).toBe("PAGO");
    expect(estadoEncargo({ ...base, anulado: true }, d("2027-01-01"))).toBe("ANULADO");
  });
});

describe("referências e recibos", () => {
  it("mesesEntre cobre o ano lectivo (set–jul = 11 meses)", () => {
    const m = mesesEntre(d("2026-09-01"), d("2027-07-15"));
    expect(m).toHaveLength(11);
    expect(m[0]).toBe("2026-09");
    expect(m[4]).toBe("2027-01");
    expect(m.at(-1)).toBe("2027-07");
  });
  it("formatos", () => {
    expect(referenciaMensal(2026, 3)).toBe("2026-03");
    expect(formatarNumeroRecibo({ serie: "R", ano: 2026, numero: 12 })).toBe("R/2026/000012");
  });
});
