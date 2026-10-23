import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Marca } from "@/components/ui/Marca";

const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function renderMarca() {
  return renderToStaticMarkup(createElement(Marca, { nome: "Escola de Enfermagem" }));
}

function luminance(hex: string) {
  const rgb = [0, 2, 4].map(
    (offset) => Number.parseInt(hex.slice(offset + 1, offset + 3), 16) / 255,
  );
  const linear = rgb.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const [red = 0, green = 0, blue = 0] = linear;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Onda 6a — tokens da proposta A", () => {
  it("usa os valores A num único sítio e preserva o token de borda de controlo", () => {
    for (const [token, value] of [
      ["--ui-fundo", "#f5faf8"],
      ["--ui-superficie", "#ffffff"],
      ["--ui-primaria", "#0f766e"],
      ["--ui-primaria-escura", "#115e59"],
      ["--ui-primaria-texto", "#ffffff"],
      ["--ui-acento", "#c2410c"],
      ["--ui-texto", "#16324f"],
      ["--ui-texto-suave", "#486581"],
      ["--ui-borda", "#d9e7e2"],
      ["--ui-borda-controlo", "#486581"],
      ["--ui-raio-sm", "0.75rem"],
      ["--ui-raio-md", "1rem"],
      ["--ui-raio-lg", "1.5rem"],
    ]) {
      expect(globals).toContain(`${token}: ${value};`);
    }
  });

  it("mantém contraste dos pares textuais e da borda de controlo", () => {
    expect(contrast("#16324f", "#f5faf8")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#0f766e")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#115e59")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#486581", "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast("#486581", "#f5faf8")).toBeGreaterThanOrEqual(3);
  });

  it("declara explicitamente a marca provisória como decorativa", () => {
    const html = renderMarca();
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">LM</span>");
    expect(html).toContain("Escola de Enfermagem");
    expect(html).not.toContain('aria-hidden="true">Escola de Enfermagem');
  });
});
