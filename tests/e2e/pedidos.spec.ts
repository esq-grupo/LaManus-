import { expect, test, type Browser, type Page } from "@playwright/test";
import { limparPedidos } from "./fixture-bd";

const SENHA = process.env.SEED_PASSWORD ?? "";
const conta = (papel: string) => `${papel}@exemplo.lamanu.test`;

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(interno|estudante|encarregado)$/);
}
async function como(browser: Browser, papel: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page, conta(papel));
  return { ctx, page };
}

test.describe.configure({ mode: "serial" });
test.beforeAll(() => limparPedidos());
test.afterAll(() => limparPedidos());

test("pedido → Direcção aprova → Secretaria emite → descarga do PDF protegida; avisos ao requerente", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const est = await como(browser, "estudante");
  const dir = await como(browser, "direccao");
  const sec = await como(browser, "secretaria");

  // 1) o estudante pede
  await est.page.goto("/estudante/pedidos");
  const form = est.page.locator("form").filter({ hasText: "Para que fim" });
  await form.getByLabel("Tipo").selectOption({ label: "Declaração de matrícula" });
  await form.getByLabel(/Para que fim/).fill("Para a embaixada");
  await form.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(form.getByRole("status")).toContainText("Pedido enviado");
  await est.page.reload();
  await expect(est.page.getByTestId("pedido-MATRICULA").getByTestId("estado-pedido")).toHaveText(
    "Por decidir",
  );

  // 2) a Secretaria ainda não pode emitir (não aprovado); a Direcção aprova
  await sec.page.goto("/interno/pedidos");
  await expect(
    sec.page.getByTestId("fila-pedidos").getByRole("button", { name: "Emitir declaração" }),
  ).toHaveCount(0);
  await dir.page.goto("/interno/pedidos");
  const aprovar = dir.page
    .getByTestId("fila-MATRICULA")
    .filter({ hasText: "Estudante Fictício 1" });
  await aprovar.getByRole("button", { name: "Aprovar" }).click();
  await expect(aprovar).toHaveCount(0);
  // a Direcção não emite
  await expect(dir.page.getByRole("button", { name: "Emitir declaração" })).toHaveCount(0);

  // 3) a Secretaria emite
  await sec.page.reload();
  const emitir = sec.page.getByTestId("fila-MATRICULA").filter({ hasText: "Estudante Fictício 1" });
  await emitir.getByRole("button", { name: "Emitir declaração" }).click();
  await expect(emitir).toHaveCount(0);

  // 4) o estudante descarrega; sem sessão não há documento; o encarregado do mesmo estudante também pode
  await est.page.goto("/estudante/pedidos");
  await expect(est.page.getByTestId("pedido-MATRICULA").getByTestId("estado-pedido")).toHaveText(
    "Emitida",
  );
  const href = await est.page.getByTestId("descarregar").getAttribute("href");
  expect(href).toMatch(/^\/declaracoes\/[0-9a-f-]{36}$/);
  const pdf = await est.page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const anonimo = await browser.newContext();
  expect((await anonimo.request.get(href!)).status()).toBe(401);
  await anonimo.close();
  expect(
    (await est.page.request.get("/declaracoes/00000000-0000-4000-8000-000000000000")).status(),
  ).toBe(404);
  const fin = await como(browser, "financeiro");
  expect((await fin.page.request.get(href!)).status()).toBe(404);
  const enc = await como(browser, "encarregado");
  expect((await enc.page.request.get(href!)).status()).toBe(200);

  // 5) avisos
  await est.page.goto("/estudante/avisos");
  await expect(est.page.getByTestId("avisos")).toContainText("Declaração emitida");
  await expect(est.page.getByTestId("avisos")).toContainText("Pedido aprovado");

  for (const c of [est, dir, sec, fin, enc]) await c.ctx.close();
});
