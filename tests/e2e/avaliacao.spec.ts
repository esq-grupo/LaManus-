import { expect, test, type Browser, type Page } from "@playwright/test";
import type { FixtureAvaliacao } from "./fixture-avaliacao";
import { criarFixture, limparFixture } from "./fixture-bd";

const SENHA = process.env.SEED_PASSWORD ?? "";
const conta = (papel: string) => `${papel}@exemplo.lamanu.test`;

async function entrarOk(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(interno|estudante|encarregado)$/);
}

async function comoUtilizador(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrarOk(page, email);
  return { ctx, page };
}

test.describe("portais: só notas publicadas (dados do seed, só leitura)", () => {
  test("estudante vê o 1.º trimestre publicado, com médias, e NADA dos trimestres validado ou em rascunho", async ({
    page,
  }) => {
    await entrarOk(page, conta("estudante"));
    const quadro = page.getByTestId("quadro-notas");
    await expect(quadro).toContainText("1.º trimestre");
    await expect(quadro).toContainText("Teste 1: 14,5");
    await expect(quadro).toContainText("Exame: 16");
    await expect(quadro).toContainText("15,4"); // média de Matemática (ponderada 40/60)
    await expect(quadro).toContainText("média geral 14,2");
    // Nenhum vestígio dos trimestres não publicados:
    for (const proibido of [
      "2.º trimestre",
      "3.º trimestre",
      "Teste 2",
      "Teste 3",
      "17",
      "18,88",
    ]) {
      await expect(quadro, proibido).not.toContainText(proibido);
    }
    const html = await page.content();
    expect(html).not.toContain("18,88");
    expect(html).not.toContain("1888");
    expect(html).not.toContain("1700");
  });

  test("encarregado vê o mesmo (e só do educando verificado)", async ({ page }) => {
    await entrarOk(page, conta("encarregado"));
    const educando = page.getByTestId("educando").filter({ hasText: "Estudante Fictício 1" });
    await expect(educando.getByTestId("quadro-notas")).toContainText("Teste 1: 14,5");
    await expect(educando.getByTestId("quadro-notas")).not.toContainText("2.º trimestre");
    await expect(page.getByText("Estudante Fictício 2")).toHaveCount(0);
  });

  test("direcção vê o estado das pautas (publicada e validada); estudante não tem acesso a pautas", async ({
    page,
    browser,
  }) => {
    await entrarOk(page, conta("direccao"));
    await page.goto("/interno/pautas");
    await expect(page.getByTestId("pauta-7.ª classe A-1.º trimestre")).toContainText("PUBLICADA");
    await expect(page.getByTestId("pauta-7.ª classe A-2.º trimestre")).toContainText("VALIDADA");
    const est = await comoUtilizador(browser, conta("estudante"));
    await est.page.goto("/interno/pautas");
    await expect(est.page).toHaveURL(/acesso-negado/);
    await est.ctx.close();
  });

  test("docente vê as suas disciplinas; num período publicado a grelha está bloqueada", async ({
    page,
  }) => {
    await entrarOk(page, conta("docente"));
    await page.goto("/interno/notas");
    await expect(page.getByTestId("disciplina-Matemática")).toBeVisible();
    await page.getByTestId("disciplina-Matemática").getByRole("link", { name: "Teste 1" }).click();
    await expect(page.getByRole("status")).toContainText("já não aceita alterações");
    await expect(page.getByLabel(/Nota de Estudante Fictício 1/)).toBeDisabled();
  });

  test("secretaria e financeiro: sem acesso a lançar notas; financeiro sem acesso a pautas", async ({
    page,
    browser,
  }) => {
    await entrarOk(page, conta("secretaria"));
    await page.goto("/interno/notas");
    await expect(page).toHaveURL(/acesso-negado/);
    const fin = await comoUtilizador(browser, conta("financeiro"));
    await fin.page.goto("/interno/pautas");
    await expect(fin.page).toHaveURL(/acesso-negado/);
    await fin.ctx.close();
  });
});

test("fluxo completo: docente lança → direcção valida → publica → encarregado vê → direcção corrige com motivo", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const fx: FixtureAvaliacao = criarFixture(SENHA);
  try {
    // 1. Docente cria a avaliação e lança as notas.
    const doc = await comoUtilizador(browser, conta("docente"));
    await doc.page.goto("/interno/notas");
    const sec = doc.page.getByTestId(`disciplina-${fx.disciplina}`);
    const nova = sec.locator("form", { hasText: "Nova avaliação" });
    await nova.getByLabel("Nome (ex.: Teste 1)").fill("Teste E2E");
    await nova.getByLabel("Peso (1 a 100)").fill("50");
    await nova.getByLabel("Data").fill(fx.periodoInicio);
    await nova.getByRole("button", { name: "Criar avaliação" }).click();
    await expect(nova.getByRole("status")).toContainText("Avaliação criada");
    await sec.getByRole("link", { name: "Teste E2E" }).click();
    await doc.page.getByLabel(`Nota de ${fx.nomeEstudante}`).fill("14,5");
    await doc.page.getByLabel(`Nota de Colega Notas ${fx.sufixo}`).fill("21"); // inválida: lote inteiro recusado
    await doc.page.getByRole("button", { name: "Guardar notas" }).click();
    await expect(doc.page.getByRole("alert").filter({ hasText: "20" })).toBeVisible();
    await doc.page.getByLabel(`Nota de Colega Notas ${fx.sufixo}`).fill("10");
    await doc.page.getByRole("button", { name: "Guardar notas" }).click();
    await expect(
      doc.page.getByRole("status").filter({ hasText: "Notas guardadas (2 novas" }),
    ).toBeVisible();

    // 2. Encarregado ainda não vê notas.
    const enc = await comoUtilizador(browser, fx.emailEncarregado);
    await expect(enc.page.getByTestId("sem-notas")).toBeVisible();

    // 3. Direcção valida; o docente já não consegue alterar; o encarregado continua sem ver.
    const dir = await comoUtilizador(browser, conta("direccao"));
    await dir.page.goto("/interno/pautas");
    await dir.page
      .getByRole("link", { name: /1\.º trimestre/ })
      .filter({ hasText: `E2E-C-${fx.sufixo}` })
      .click();
    await expect(dir.page.getByTestId("estado-pauta")).toHaveText("RASCUNHO");
    await dir.page.getByRole("button", { name: "Validar pauta" }).click();
    await expect(dir.page.getByTestId("estado-pauta")).toHaveText("VALIDADA");
    await doc.page.reload();
    await expect(doc.page.getByRole("status").filter({ hasText: "validada" })).toBeVisible();
    await expect(doc.page.getByLabel(`Nota de ${fx.nomeEstudante}`)).toBeDisabled();
    await enc.page.reload();
    await expect(enc.page.getByTestId("sem-notas")).toBeVisible();

    // 4. Publicar → o encarregado passa a ver a nota e a média.
    await dir.page.getByRole("button", { name: "Publicar pauta" }).click();
    await expect(dir.page.getByTestId("estado-pauta")).toHaveText("PUBLICADA");
    await enc.page.reload();
    const quadro = enc.page.getByTestId("quadro-notas");
    await expect(quadro).toContainText(`Teste E2E: 14,5`);
    await expect(quadro).toContainText("14,5");

    // 5. Correcção com motivo (só a Direcção) → o encarregado vê o valor novo.
    const corrigir = dir.page.locator("form", { hasText: "Corrigir uma nota publicada" });
    await corrigir.getByLabel("Novo valor (0 a 20)").fill("16");
    await corrigir.getByLabel("Motivo (obrigatório)").fill("Erro de digitação do docente");
    await corrigir.getByRole("button", { name: "Corrigir nota" }).click();
    await expect(corrigir.getByRole("status")).toContainText("Nota corrigida");
    await enc.page.reload();
    await expect(enc.page.getByTestId("quadro-notas")).toContainText("Teste E2E: 16");
    await expect(enc.page.getByTestId("quadro-notas")).not.toContainText("Teste E2E: 14,5");
    for (const x of [doc, enc, dir]) await x.ctx.close();
  } finally {
    limparFixture(fx);
  }
});
