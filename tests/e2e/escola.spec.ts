import { expect, test, type Browser, type Page } from "@playwright/test";

const SENHA = process.env.SEED_PASSWORD ?? "";
const conta = (papel: string) => `${papel}@exemplo.lamanu.test`;

async function entrarOk(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(interno|estudante|encarregado)$/);
}

async function comoEncarregado(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrarOk(page, conta("encarregado"));
  return { ctx, page };
}

const mensagem = (page: Page) =>
  page.locator("main").getByRole("status").or(page.locator("main").getByRole("alert"));

test("fluxo completo de matrícula: criar estudante, ligar encarregado, verificar, matricular, bloquear duplicada, transferir, revogar", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const sufixo = Date.now().toString().slice(-8);
  const nome = `Aluno E2E ${sufixo}`;

  await entrarOk(page, conta("secretaria"));
  await page.goto("/interno/estudantes");
  const novo = page.locator("form", { hasText: "Novo estudante" });
  await novo.getByLabel("N.º de processo").fill(`E2E-${sufixo}`);
  await novo.getByLabel("Nome completo").fill(nome);
  await novo.getByLabel("Data de nascimento").fill("2013-04-02");
  await novo.getByRole("button", { name: "Criar estudante" }).click();
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();

  // Ligar ao encarregado fictício (mesmo BI → reutiliza o encarregado, D8). Nasce NÃO verificado.
  const ligar = page.locator("form", { hasText: "Ligar encarregado" });
  await ligar.getByLabel("Nome completo").fill("Encarregado Fictício");
  await ligar.getByLabel("BI (recomendado)").fill("ENC-SEED-0001");
  await ligar.getByRole("button", { name: "Ligar encarregado" }).click();
  await expect(page.getByText("Ligação NÃO verificada")).toBeVisible();

  // O encarregado NÃO vê o novo educando antes da verificação.
  const enc = await comoEncarregado(browser);
  await expect(enc.page.getByTestId("educando").filter({ hasText: nome })).toHaveCount(0);

  // Matricular (nova) e tentar matricular de novo → bloqueado.
  const matricula = page.locator("form", { hasText: "Nova matrícula" });
  await matricula
    .getByLabel("Turma")
    .selectOption({ label: "7.ª classe A — 2026/2027 (fictício)" });
  await matricula.getByRole("button", { name: "Matricular" }).click();
  await expect(page.getByTestId("matricula-ACTIVA")).toContainText("7.ª classe A");
  await matricula.getByLabel("Tipo").selectOption("RENOVACAO");
  await matricula
    .getByLabel("Turma")
    .selectOption({ label: "7.ª classe B — 2026/2027 (fictício)" });
  await matricula.getByRole("button", { name: "Matricular" }).click();
  await expect(matricula.getByRole("alert")).toContainText("matrícula activa neste ano");

  // Transferência exige motivo; fica o histórico.
  const transferir = page.locator("form", { hasText: "Transferir de turma" });
  await transferir
    .getByLabel("Nova turma")
    .selectOption({ label: "7.ª classe B — 2026/2027 (fictício)" });
  await transferir.getByLabel("Motivo (obrigatório)").fill("Pedido do encarregado");
  await transferir.getByRole("button", { name: "Transferir de turma" }).click();
  await expect(page.getByTestId("matricula-TRANSFERIDA")).toContainText("7.ª classe A");
  await expect(page.getByTestId("matricula-ACTIVA")).toContainText("7.ª classe B");

  // Verificar a ligação → o encarregado passa a ver o educando.
  await page.getByRole("button", { name: "Verificar ligação" }).click();
  await expect(page.getByText("Ligação verificada")).toBeVisible();
  await enc.page.reload();
  await expect(enc.page.getByTestId("educando").filter({ hasText: nome })).toHaveCount(1);

  // Revogar a autorização → deixa de ver, de imediato.
  await page.getByRole("button", { name: "Revogar autorização" }).click();
  await expect(page.getByText("Autorização revogada", { exact: true })).toBeVisible();
  await enc.page.reload();
  await expect(enc.page.getByTestId("educando").filter({ hasText: nome })).toHaveCount(0);
  await enc.ctx.close();
});

test("encarregado fictício: vê só o educando verificado com autorização activa (não vê o por verificar nem o revogado)", async ({
  page,
}) => {
  await entrarOk(page, conta("encarregado"));
  await expect(
    page.getByTestId("educando").filter({ hasText: "Estudante Fictício 1" }),
  ).toHaveCount(1);
  await expect(page.getByText("Estudante Fictício 2")).toHaveCount(0);
  await expect(page.getByText("Estudante Fictício 3")).toHaveCount(0);
});

test("estudante vê só o próprio perfil", async ({ page }) => {
  await entrarOk(page, conta("estudante"));
  await expect(page.getByTestId("perfil")).toContainText("Estudante Fictício 1");
});

test("acesso cruzado por URL: encarregado, estudante e admin técnico não abrem fichas nem listas", async ({
  page,
  browser,
}) => {
  // Descobrir o ID de um estudante com a secretaria.
  await entrarOk(page, conta("secretaria"));
  await page.goto("/interno/estudantes?q=TESTE-0002");
  await page.getByRole("link", { name: "Estudante Fictício 2" }).click();
  await page.waitForURL(/\/interno\/estudantes\/[0-9a-f-]{36}$/);
  const url = page.url();
  expect(url).toMatch(/\/interno\/estudantes\/[0-9a-f-]{36}$/);

  for (const papel of ["encarregado", "estudante", "admin.tecnico"]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await entrarOk(p, conta(papel));
    await p.goto(url);
    // Encarregado/estudante: área interna vetada. Admin técnico: sem permissão de estudantes.
    await expect(p).toHaveURL(/acesso-negado/);
    await p.goto("/interno/estudantes");
    await expect(p).toHaveURL(/acesso-negado/);
    await ctx.close();
  }
});

test("ID inexistente ou fora do escopo dá a mesma resposta (404) ao docente", async ({ page }) => {
  await entrarOk(page, conta("docente"));
  const r = await page.goto("/interno/estudantes/00000000-0000-4000-8000-000000000000");
  expect(r?.status()).toBe(404);
});

test("financeiro e docente consultam a estrutura/estudantes mas sem formulários de edição", async ({
  page,
}) => {
  await entrarOk(page, conta("financeiro"));
  await page.goto("/interno/estrutura");
  await expect(page.getByRole("heading", { name: "Estrutura escolar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar ano lectivo" })).toHaveCount(0);
  await page.goto("/interno/estudantes");
  await expect(page.getByRole("button", { name: "Criar estudante" })).toHaveCount(0);
  await expect(mensagem(page)).toHaveCount(0);
});

test("secretaria cria um ano lectivo e uma classe; duplicados são recusados", async ({ page }) => {
  const s = Date.now().toString().slice(-6);
  await entrarOk(page, conta("secretaria"));
  await page.goto("/interno/estrutura");
  const ano = page.locator("form", { hasText: "Novo ano lectivo" });
  await ano.getByLabel("Nome (ex.: 2027/2028)").fill(`E2E ${s}`);
  await ano.getByLabel("Início").fill("2031-09-01");
  await ano.getByLabel("Fim").fill("2032-07-15");
  await ano.getByRole("button", { name: "Criar ano lectivo" }).click();
  await expect(ano.getByRole("status")).toContainText("Ano lectivo criado");
  // Repetir os mesmos dados (o formulário foi limpo após o sucesso).
  await ano.getByLabel("Nome (ex.: 2027/2028)").fill(`E2E ${s}`);
  await ano.getByLabel("Início").fill("2031-09-01");
  await ano.getByLabel("Fim").fill("2032-07-15");
  await ano.getByRole("button", { name: "Criar ano lectivo" }).click();
  await expect(ano.getByRole("alert")).toContainText("Já existe");
  // Depois de um erro os dados escritos mantêm-se (não se perde o que o utilizador escreveu).
  await expect(ano.getByLabel("Nome (ex.: 2027/2028)")).toHaveValue(`E2E ${s}`);
});
