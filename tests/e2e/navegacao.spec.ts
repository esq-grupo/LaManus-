import { expect, test, type Page } from "@playwright/test";

// A página inicial da área interna lista só o que cada papel pode usar, e a barra tem ligações para Notas e Pautas.
const SENHA = process.env.SEED_PASSWORD ?? "";
const conta = (papel: string) => `${papel}@exemplo.lamanu.test`;

async function entrar(page: Page, papel: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(conta(papel));
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/interno$/);
}
const barra = (page: Page) => page.getByRole("banner").getByRole("link");

test("início da área interna: sem texto de obra e com atalhos por papel", async ({ page }) => {
  expect(SENHA, "SEED_PASSWORD tem de estar definida").not.toBe("");
  await entrar(page, "docente");
  await expect(page.getByText("Em construção")).toHaveCount(0);
  await expect(barra(page).filter({ hasText: /^Notas$/ })).toHaveCount(1);
  await expect(barra(page).filter({ hasText: /^Pautas$/ })).toHaveCount(1);
  await expect(barra(page).filter({ hasText: /^Utilizadores$/ })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: /Notas/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /Utilizadores/ })).toHaveCount(0);
});

test("Direcção vê Pautas (e não lança Notas); Administrador técnico só estrutura e utilizadores", async ({
  page,
}) => {
  await entrar(page, "direccao");
  await expect(barra(page).filter({ hasText: /^Pautas$/ })).toHaveCount(1);
  await expect(barra(page).filter({ hasText: /^Notas$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Sair" }).click();
  await entrar(page, "admin.tecnico");
  await expect(barra(page).filter({ hasText: /^Utilizadores$/ })).toHaveCount(1);
  await expect(barra(page).filter({ hasText: /^(Notas|Pautas|Financeiro)$/ })).toHaveCount(0);
  await expect(page.getByText("Em construção")).toHaveCount(0);
});
