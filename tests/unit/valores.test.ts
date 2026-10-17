import { describe, expect, it } from "vitest";
import { contemValor } from "../valores";

describe("contemValor (verificação de fugas sem falsos positivos)", () => {
  it("não confunde o valor com pedaços de UUIDs ou de outros números", () => {
    expect(contemValor('{"id":"3f2a1777-aaaa-4b1c-8d00-0000177700ab"}', 1777)).toBe(false);
    expect(contemValor('{"id":"1777abcd-0000-4000-8000-000000000000"}', 1777)).toBe(false);
    expect(contemValor('{"id":"aaaa-1777-bbbb"}', 1777)).toBe(false);
    expect(contemValor('{"valor":21777}', 1777)).toBe(false);
  });
  it("encontra o valor quando aparece mesmo como número", () => {
    expect(contemValor('{"valor":1777,"peso":40}', 1777)).toBe(true);
    expect(contemValor("[1777]", 1777)).toBe(true);
    expect(contemValor("<td>1777</td>", 1777)).toBe(true);
  });
});
