import { expect, test } from "@playwright/test";

test("a página inicial mostra as três áreas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Lá Manu/ })).toBeVisible();
  for (const nome of ["Área interna", "Portal do Estudante", "Portal do Encarregado"]) {
    await expect(page.getByText(nome, { exact: true })).toBeVisible();
  }
});
