import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Alerta } from "@/components/ui/Alerta";
import { Botao } from "@/components/ui/Botao";
import { Campo } from "@/components/ui/Campo";
import { Cartao } from "@/components/ui/Cartao";
import { Etiqueta } from "@/components/ui/Etiqueta";
import { Tabela } from "@/components/ui/Tabela";

const root = process.cwd();
const globals = readFileSync(join(root, "src/app/globals.css"), "utf8");

function render(node: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(node);
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

describe("sistema de desenho — componentes", () => {
  it("renderiza Botao nas variantes e bloqueia enquanto carrega", () => {
    const html = render(
      createElement(Botao, { variante: "primario", carregando: true }, "Guardar"),
    );
    const perigo = render(createElement(Botao, { variante: "perigo", disabled: true }, "Apagar"));
    const secundario = render(createElement(Botao, { variante: "secundario" }, "Voltar"));

    expect(html).toContain("bg-primaria");
    expect(html).toContain("A carregar…");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("disabled");
    expect(perigo).toContain("bg-perigo");
    expect(secundario).toContain("border-borda");
    expect(html).toContain("min-h-11");
  });

  it("renderiza Cartao com título e conteúdo", () => {
    const html = render(
      createElement(Cartao, { titulo: "Resumo" }, createElement("span", null, "Conteúdo")),
    );

    expect(html).toContain("<section");
    expect(html).toContain("<h2");
    expect(html).toContain("Resumo");
    expect(html).toContain("Conteúdo");
    expect(html).toContain("bg-superficie");
  });

  it("liga Campo, ajuda e erro sem p dentro do label", () => {
    const html = render(
      createElement(Campo, {
        id: "email",
        rotulo: "Email",
        ajuda: "Use o email institucional.",
        erro: "Email inválido.",
        type: "email",
      }),
    );

    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeDefined();
    expect(html).toContain('<label for="email"');
    expect(html).toContain("<span>Email</span>");
    expect(html).not.toMatch(/<label[^>]*>[\s\S]*<p/);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`id="${describedBy?.split(" ")[0]}"`);
    expect(html).toContain("Use o email institucional.");
    expect(html).toContain("Email inválido.");
    expect(html).toContain("min-h-11");
  });

  it("renderiza Etiqueta para estados semânticos", () => {
    const estados = ["neutro", "sucesso", "aviso", "erro"] as const;
    const html = estados
      .map((estado) => render(createElement(Etiqueta, { estado }, estado)))
      .join("");

    expect(html).toContain("bg-sucesso");
    expect(html).toContain("bg-aviso");
    expect(html).toContain("bg-perigo");
    expect(html).toContain("rounded-raio-pill");
  });

  it("atribui role adequado a Alerta", () => {
    const informacao = render(
      createElement(Alerta, { tipo: "informacao" }, "Informação disponível."),
    );
    const erro = render(createElement(Alerta, { tipo: "erro" }, "Não foi possível."));

    expect(informacao).toContain('role="status"');
    expect(informacao).toContain("bg-informacao");
    expect(erro).toContain('role="alert"');
    expect(erro).toContain("bg-perigo");
  });

  it("contém a tabela numa região com rolagem horizontal", () => {
    const html = render(
      createElement(
        Tabela,
        { ariaLabel: "Lista de estudantes" },
        createElement("table", null, createElement("tbody", null, createElement("tr", null))),
      ),
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Lista de estudantes"');
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("focus-visible:ring-foco");
  });
});

describe("sistema de desenho — tokens e regras", () => {
  it("declara os tokens semânticos no @theme e a pilha de sistema", () => {
    expect(globals).toContain("@theme inline");
    for (const token of [
      "--color-fundo",
      "--color-superficie",
      "--color-texto",
      "--color-texto-suave",
      "--color-primaria",
      "--color-primaria-texto",
      "--color-borda",
      "--color-perigo",
      "--color-sucesso",
      "--color-aviso",
      "--color-informacao",
      "--color-foco",
      "--radius-raio-sm",
      "--shadow-sombra-subtil",
      "--spacing-espaco-4",
      "--text-tamanho-base",
      "--font-sans",
    ]) {
      expect(globals).toContain(token);
    }
    expect(globals).toContain("system-ui");
    expect(globals).not.toMatch(/https?:\/\//);
  });

  it("mantém contraste WCAG nos pares de tokens iniciais", () => {
    const value = (token: string) =>
      globals.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    const fundo = value("--ui-fundo");
    const texto = value("--ui-texto");
    const primaria = value("--ui-primaria");
    const primariaTexto = value("--ui-primaria-texto");

    expect(fundo).toBeDefined();
    expect(texto).toBeDefined();
    expect(primaria).toBeDefined();
    expect(primariaTexto).toBeDefined();
    expect(contrast(texto!, fundo!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(primariaTexto!, primaria!)).toBeGreaterThanOrEqual(4.5);
  });

  it("não usa cores literais nos componentes UI", () => {
    const directory = join(root, "src/components/ui");
    const files = readdirSync(directory).filter((file) => file.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      const source = readFileSync(join(directory, file), "utf8");
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, file).not.toMatch(/\b(?:rgb|rgba)\(/);
    }
  });
});
