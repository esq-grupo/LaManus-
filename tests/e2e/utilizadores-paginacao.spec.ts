import { expect, test } from "@playwright/test";
import { criarUtilizadoresPaginacao, limparUtilizadoresPaginacao } from "./fixture-bd";
import type { FixtureUtilizadoresPaginacao } from "./fixture-cli";

const SENHA = process.env.SEED_PASSWORD ?? "";
const ADMIN = "admin.tecnico@exemplo.lamanu.test";
let fixture: FixtureUtilizadoresPaginacao;

test.beforeAll(() => {
  expect(SENHA, "SEED_PASSWORD tem de estar definida (ver .env.example)").not.toBe("");
  fixture = criarUtilizadoresPaginacao(SENHA);
});

test.afterAll(() => {
  if (fixture) limparUtilizadoresPaginacao(fixture);
});

test("administrador navega nas páginas e a ligação preserva a pesquisa", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN);
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/interno$/);

  await page.goto(`/interno/utilizadores?q=${encodeURIComponent(fixture.q)}`);
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await expect(page.getByText("A mostrar 1–50 de 51 utilizadores")).toBeVisible();

  const navegacao = page.getByRole("navigation", { name: "Navegação de páginas" });
  const seguinte = navegacao.getByRole("link", { name: "Seguinte" });
  await expect(seguinte).toBeVisible();
  const href = await seguinte.getAttribute("href");
  expect(href).not.toBeNull();
  const url = new URL(href!, "http://localhost:3100");
  expect(url.searchParams.get("q")).toBe(fixture.q);
  expect(url.searchParams.get("pagina")).toBe("2");
  expect((await seguinte.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  await seguinte.click();
  await expect(page.getByText("Página 2 de 2")).toBeVisible();
  await expect(page.getByText("A mostrar 51–51 de 51 utilizadores")).toBeVisible();
  await expect(navegacao.getByRole("link", { name: "Anterior" })).toBeVisible();
  await expect(navegacao.getByRole("link", { name: "Seguinte" })).toHaveCount(0);
});
