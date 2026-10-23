import { expect, test } from "@playwright/test";

const rotas = [
  { nome: "login", caminho: "/login" },
  { nome: "recuperar", caminho: "/recuperar" },
  { nome: "redefinir", caminho: "/redefinir/token-ficticio" },
  { nome: "acesso-negado", caminho: "/acesso-negado" },
  { nome: "offline", caminho: "/offline" },
];

const tamanhos = [
  { nome: "390", width: 390, height: 844 },
  { nome: "1280", width: 1280, height: 900 },
];

for (const tamanho of tamanhos) {
  test.describe(`Onda 6a — entrada a ${tamanho.width}px`, () => {
    test.use({ viewport: { width: tamanho.width, height: tamanho.height } });

    for (const rota of rotas) {
      test(`${rota.nome} sem rolagem, alvos acessíveis e salto ao conteúdo`, async ({ page }) => {
        await page.goto(rota.caminho);
        await expect(page.getByRole("heading")).toHaveCount(1);
        await expect(page.getByText("Lá Manu", { exact: true }).first()).toBeVisible();

        const salto = page.getByRole("link", { name: "Saltar para o conteúdo" });
        await expect(salto).toHaveCount(1);
        await salto.focus();
        await expect(salto).toBeVisible();

        const medidas = await page.evaluate(() => {
          const interactivos = Array.from(
            document.querySelectorAll<HTMLElement>(
              "a, button, input, select, textarea, [role='button']",
            ),
          )
            .map((elemento) => {
              const estilo = window.getComputedStyle(elemento);
              const rect = elemento.getBoundingClientRect();
              return {
                largura: rect.width,
                altura: rect.height,
                visivel:
                  estilo.display !== "none" &&
                  estilo.visibility !== "hidden" &&
                  rect.width > 0 &&
                  rect.height > 0,
              };
            })
            .filter((elemento) => elemento.visivel);

          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            menorAlvo: Math.min(
              ...interactivos.map(({ largura, altura }) => Math.min(largura, altura)),
            ),
          };
        });

        expect(medidas.scrollWidth).toBeLessThanOrEqual(medidas.clientWidth);
        expect(medidas.menorAlvo).toBeGreaterThanOrEqual(44);
      });
    }
  });
}
