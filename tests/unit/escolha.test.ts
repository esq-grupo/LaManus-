import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Escolha } from "@/components/FormAcao";

const dica = "Ainda não há anos lectivos abertos: crie primeiro um ano lectivo.";

function renderEscolha(props: Parameters<typeof Escolha>[0]) {
  return renderToStaticMarkup(createElement(Escolha, props));
}

describe("Escolha — estado sem opções", () => {
  it("liga a dica ao selector quando não há opções", () => {
    const html = renderEscolha({
      nome: "anoLectivoId",
      rotulo: "Ano lectivo",
      opcoes: [],
      semOpcoes: dica,
    });

    const id = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(id).toBeDefined();
    expect(html).toContain(`<p id="${id}"`);
    expect(html).toContain("text-sm text-slate-600");
    expect(html).toContain(dica);
  });

  it("não acrescenta dica nem aria-describedby quando há opções", () => {
    const html = renderEscolha({
      nome: "anoLectivoId",
      rotulo: "Ano lectivo",
      opcoes: [{ valor: "a1", texto: "2026/2027" }],
      semOpcoes: dica,
    });

    expect(html).toContain("2026/2027");
    expect(html).not.toContain(dica);
    expect(html).not.toContain("aria-describedby");
  });

  it("mantém o selector sem dica quando semOpcoes não é definida", () => {
    const html = renderEscolha({
      nome: "anoLectivoId",
      rotulo: "Ano lectivo",
      opcoes: [],
    });

    expect(html).toContain('<select name="anoLectivoId"');
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("<p");
  });
});
