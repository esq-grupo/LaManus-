import { expect, test, type Page } from "@playwright/test";
import { criarPortais, limparPortais } from "./fixture-bd";
import type { FixturePortais } from "./fixture-cli";

const SENHA = process.env.SEED_PASSWORD ?? "";

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(interno|estudante|encarregado)$/);
}

// Telemóvel de gama baixa: 360×640.
test.use({ viewport: { width: 360, height: 640 } });

let fx: FixturePortais;
test.beforeAll(() => {
  fx = criarPortais(SENHA);
});
test.afterAll(() => limparPortais(fx));

async function semRolagemHorizontal(page: Page) {
  const [largura, visivel] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(largura).toBeLessThanOrEqual(visivel);
}

test("estudante no telemóvel: sem rolagem horizontal e alvos de toque ≥ 44 px", async ({
  page,
}) => {
  await entrar(page, "estudante@exemplo.lamanu.test");
  await expect(page.getByTestId("perfil")).toBeVisible();
  await semRolagemHorizontal(page);
  for (const alvo of [page.getByTestId("nav-avisos"), page.getByRole("button", { name: "Sair" })]) {
    const caixa = await alvo.boundingBox();
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByTestId("nav-avisos").click();
  await expect(page.getByRole("heading", { name: "Avisos" })).toBeVisible();
  await semRolagemHorizontal(page);
});

test("encarregado com vários educandos: selector, cada educando no seu endereço e acesso cruzado → 404", async ({
  page,
}) => {
  await entrar(page, fx.email);
  const seletor = page.getByTestId("seletor-educando");
  await expect(seletor.getByRole("link", { name: fx.educandoA.nome })).toBeVisible();
  await expect(seletor.getByRole("link", { name: fx.educandoB.nome })).toBeVisible();
  // educando por verificar e aluno de outra família não aparecem em lado nenhum
  await expect(page.getByText(fx.naoVerificado.nome)).toHaveCount(0);
  await expect(page.getByText(fx.alheio.nome)).toHaveCount(0);
  await semRolagemHorizontal(page);

  await seletor.getByRole("link", { name: fx.educandoB.nome }).click();
  await expect(page).toHaveURL(new RegExp(`/encarregado/${fx.educandoB.id}$`));
  await expect(page.getByTestId("educando")).toContainText(fx.educandoB.nome);
  await expect(page.getByTestId("educando")).not.toContainText(fx.educandoA.nome);

  // Trocar o id no endereço: por verificar, de outra família, inexistente e lixo → a MESMA resposta (404)
  for (const id of [
    fx.naoVerificado.id,
    fx.alheio.id,
    "00000000-0000-4000-8000-000000000000",
    "nao-e-um-id",
  ]) {
    const r = await page.goto(`/encarregado/${id}`);
    expect(r!.status(), id).toBe(404);
    await expect(page.getByText(fx.alheio.nome)).toHaveCount(0);
  }
  // recibos de outro estudante também não saem
  const rec = await page.request.get("/recibos/00000000-0000-4000-8000-000000000000");
  expect(rec.status()).toBe(404);
});

test("o estudante não entra no portal do encarregado nem no interno (e vice-versa)", async ({
  page,
}) => {
  await entrar(page, "estudante@exemplo.lamanu.test");
  await page.goto(`/encarregado/${fx.educandoA.id}`);
  await expect(page).toHaveURL(/acesso-negado/);
  await page.goto("/interno/financeiro");
  await expect(page).toHaveURL(/acesso-negado/);
});
