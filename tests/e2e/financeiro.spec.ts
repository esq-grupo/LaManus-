import { expect, test, type Browser, type Page } from "@playwright/test";
import { limparFinanceiro } from "./fixture-bd";

const SENHA = process.env.SEED_PASSWORD ?? "";
const conta = (papel: string) => `${papel}@exemplo.lamanu.test`;
const hoje = new Date().toISOString().slice(0, 10);

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

// Percurso completo, sequencial: o estado de um passo é o ponto de partida do seguinte.
test.describe.configure({ mode: "serial" });
test.afterAll(() => limparFinanceiro());

const nomeTipo = `E2E-FIN-${Date.now().toString().slice(-7)}`;

test("financeiro regista, direcção confirma, recibo PDF, portais e estorno com dupla aprovação", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const fin = await como(browser, "financeiro");
  const dir = await como(browser, "direccao");

  // 1) Financeiro cria o tipo e gera as propinas do mês (idempotente).
  await fin.page.goto("/interno/financeiro");
  await fin.page.getByLabel("Nome (ex.: Propina mensal)").fill(nomeTipo);
  await fin.page.getByLabel("Valor de referência (Kz)").fill("50000");
  await fin.page.getByRole("button", { name: "Criar tipo" }).click();
  await expect(
    fin.page.getByRole("status").filter({ hasText: "Tipo de encargo criado" }),
  ).toBeVisible();
  await fin.page.reload();
  const formGerar = fin.page.locator("form").filter({ hasText: "Dia de vencimento" });
  await formGerar.getByLabel("Tipo (mensal)").selectOption({ label: nomeTipo });
  await formGerar.getByLabel("Ano lectivo").selectOption({ label: "2026/2027 (fictício)" });
  await formGerar.getByLabel("Mês (AAAA-MM)").fill("2026-10");
  await formGerar.getByRole("button", { name: "Gerar propinas" }).click();
  await expect(formGerar.getByRole("status")).toContainText(/Propinas geradas: [1-9]\d* novas/);
  // o formulário limpa-se após o sucesso: repetir o pedido não pode duplicar nada
  await formGerar.getByLabel("Tipo (mensal)").selectOption({ label: nomeTipo });
  await formGerar.getByLabel("Ano lectivo").selectOption({ label: "2026/2027 (fictício)" });
  await formGerar.getByLabel("Mês (AAAA-MM)").fill("2026-10");
  await formGerar.getByRole("button", { name: "Gerar propinas" }).click();
  await expect(formGerar.getByRole("status")).toContainText("Propinas geradas: 0 novas");

  // 2) Regista um pagamento de 60 000 Kz (excede a propina) — fica por confirmar e NÃO muda as contas.
  await fin.page.getByPlaceholder("Nome ou n.º de processo").fill("TESTE-0001");
  await fin.page.getByRole("button", { name: "Procurar" }).click();
  await fin.page.getByRole("link", { name: "Estudante Fictício 1" }).click();
  await expect(fin.page.getByTestId("em-divida")).toHaveText("50 000 Kz");
  const formPag = fin.page.locator("form").filter({ hasText: "Aplicação do valor" });
  await formPag.getByLabel("Valor (Kz)").fill("60000");
  await formPag.getByLabel("Data do pagamento").fill(hoje);
  await formPag.getByLabel("Referência do banco/talão (opcional)").fill("TRF-E2E-1");
  await formPag.getByRole("button", { name: "Registar pagamento" }).click();
  await expect(formPag.getByRole("status")).toContainText("Aguarda a confirmação");
  await fin.page.reload();
  await expect(fin.page.getByTestId("em-divida")).toHaveText("50 000 Kz");
  // Quem regista não confirma: o Financeiro não tem o botão.
  await expect(fin.page.getByRole("button", { name: "Confirmar e emitir recibo" })).toHaveCount(0);

  // 3) A Direcção confirma → alocação automática, recibo e crédito.
  await dir.page.goto("/interno/financeiro");
  const item = dir.page
    .getByTestId("por-confirmar")
    .locator("li")
    .filter({ hasText: "Estudante Fictício 1" })
    .filter({ hasText: "60 000 Kz" });
  await item.getByRole("button", { name: "Confirmar e emitir recibo" }).click();
  // o pagamento sai da fila assim que é confirmado (a página é revalidada)
  await expect(item).toHaveCount(0);
  await fin.page.reload();
  await expect(fin.page.getByTestId("em-divida")).toHaveText("0 Kz");
  await expect(fin.page.getByTestId("credito")).toHaveText("10 000 Kz");
  const reciboHref = await fin.page.getByTestId("recibo").getAttribute("href");
  expect(reciboHref).toMatch(/^\/recibos\/[0-9a-f-]{36}$/);
  const pdf = await fin.page.request.get(reciboHref!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // 4) Portais: estudante vê as suas contas e o recibo; sem sessão não há recibo.
  const est = await como(browser, "estudante");
  await expect(est.page.getByTestId("extracto")).toContainText("Em dívida");
  await expect(est.page.getByTestId("credito")).toHaveText("10 000 Kz");
  expect((await est.page.request.get(reciboHref!)).status()).toBe(200);
  const anonimo = await browser.newContext();
  expect((await anonimo.request.get(reciboHref!)).status()).toBe(401);
  await anonimo.close();
  const enc = await como(browser, "encarregado");
  const educando = enc.page.getByTestId("educando").filter({ hasText: "Estudante Fictício 1" });
  await expect(educando.getByTestId("extracto")).toBeVisible();
  expect((await enc.page.request.get(reciboHref!)).status()).toBe(200);
  // O estudante não entra no financeiro interno.
  await est.page.goto("/interno/financeiro");
  await expect(est.page).toHaveURL(/acesso-negado/);

  // 5) Estorno: o Financeiro propõe; só a Direcção aprova; o crédito desaparece.
  const formEstorno = fin.page.locator("form").filter({ hasText: "Valor a estornar" });
  await formEstorno.getByLabel("Valor a estornar (Kz)").fill("10000");
  await formEstorno.getByLabel("Motivo").fill("Pago em duplicado");
  await formEstorno.getByRole("button", { name: "Propor estorno" }).click();
  await expect(formEstorno.getByRole("status")).toContainText("Aguarda a aprovação");
  await dir.page.reload();
  const pedido = dir.page
    .getByTestId("estornos-por-decidir")
    .locator("li")
    .filter({ hasText: "Pago em duplicado" });
  await pedido.getByRole("button", { name: "Aprovar estorno" }).click();
  await expect(pedido).toHaveCount(0);
  await fin.page.reload();
  await expect(fin.page.getByTestId("credito")).toHaveText("0 Kz");
  await expect(fin.page.getByTestId("em-divida")).toHaveText("0 Kz");

  // 6) Relatórios e verificação das contas.
  await dir.page.goto("/interno/financeiro/relatorios");
  await expect(dir.page.getByTestId("reconciliacao-ok")).toBeVisible();
  await dir.page.getByTestId("rel-recebimentos").getByRole("button", { name: "Ver" }).click();
  await expect(dir.page.getByTestId("liquido")).toBeVisible();

  for (const c of [fin, dir, est, enc]) await c.ctx.close();
});
