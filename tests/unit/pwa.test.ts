import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA — manifesto", () => {
  const m = manifest();
  it("é instalável: nome, início, modo autónomo, língua e cores", () => {
    expect(m.name).toContain("Lá Manu");
    expect(m.short_name).toBe("Lá Manu");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.lang).toBe("pt-AO");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it("tem ícones 192 e 512 e um «maskable»", () => {
    const tamanhos = (m.icons ?? []).map((i) => `${i.sizes}:${i.purpose}`);
    expect(tamanhos).toContain("192x192:any");
    expect(tamanhos).toContain("512x512:any");
    expect(tamanhos).toContain("512x512:maskable");
  });
});

describe("PWA — o service worker não guarda dados de ninguém", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  it("só trata navegações e só guarda a página /offline", () => {
    expect(sw).toContain('pedido.mode !== "navigate"');
    expect(sw).toMatch(/c\.add\(OFFLINE\)/);
    // nenhum outro sítio escreve na cache
    expect(sw.match(/\.put\(|\.addAll\(|\.add\(/g)).toHaveLength(1);
    expect(sw).not.toMatch(/cache\.put|\.put\(/);
  });
});
