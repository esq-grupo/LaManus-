import { describe, expect, it } from "vitest";
import { hojeEmLuanda } from "@/lib/datas";

describe("hojeEmLuanda (Africa/Luanda = UTC+1, sem hora de verão)", () => {
  it("devolve sempre a data de Luanda, independentemente do fuso do servidor", () => {
    expect(hojeEmLuanda(new Date("2031-03-10T22:59:59Z")).toISOString()).toBe(
      "2031-03-10T00:00:00.000Z",
    );
    expect(hojeEmLuanda(new Date("2031-03-10T23:00:00Z")).toISOString()).toBe(
      "2031-03-11T00:00:00.000Z",
    );
    expect(hojeEmLuanda(new Date("2031-12-31T23:30:00Z")).toISOString()).toBe(
      "2032-01-01T00:00:00.000Z",
    );
  });
});
