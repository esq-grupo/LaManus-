import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SENHA = process.env.SEED_PASSWORD ?? "";
const conta = (papel: string) => `${papel}@exemplo.lamanu.test`;

async function entrar(page: Page, email: string, senha = SENHA) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Entra com credenciais válidas e espera pelo redireccionamento para a área. */
async function entrarOk(page: Page, email: string, senha = SENHA) {
  await entrar(page, email, senha);
  await page.waitForURL(/\/(interno|estudante|encarregado)$/);
}

test.beforeAll(() => {
  expect(SENHA, "SEED_PASSWORD tem de estar definida (ver .env.example)").not.toBe("");
});

test("visitante anónimo é reenviado para o login em todas as áreas", async ({ page }) => {
  for (const area of ["/interno", "/estudante", "/encarregado", "/interno/utilizadores"]) {
    await page.goto(area);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("password errada mostra erro genérico", async ({ page }) => {
  await entrar(page, conta("docente"), "errada-errada-123");
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Email ou palavra-passe incorrectos.",
  );
  await entrar(page, "naoexiste@exemplo.lamanu.test", "errada-errada-123");
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Email ou palavra-passe incorrectos.",
  );
});

test("docente entra na área interna mas não no portal do estudante nem na gestão de utilizadores", async ({
  page,
}) => {
  await entrarOk(page, conta("docente"));
  await expect(page).toHaveURL(/\/interno$/);
  await page.goto("/estudante");
  await expect(page).toHaveURL(/acesso-negado/);
  await page.goto("/encarregado");
  await expect(page).toHaveURL(/acesso-negado/);
  await page.goto("/interno/utilizadores");
  await expect(page).toHaveURL(/acesso-negado/);
});

test("estudante e encarregado ficam presos ao seu portal", async ({ page }) => {
  await entrarOk(page, conta("estudante"));
  await expect(page).toHaveURL(/\/estudante$/);
  await page.goto("/interno");
  await expect(page).toHaveURL(/acesso-negado/);
  await page.context().clearCookies();
  await entrarOk(page, conta("encarregado"));
  await expect(page).toHaveURL(/\/encarregado$/);
  await page.goto("/estudante");
  await expect(page).toHaveURL(/acesso-negado/);
});

test("direcção vê utilizadores mas não os pode gerir", async ({ page }) => {
  await entrarOk(page, conta("direccao"));
  await page.goto("/interno/utilizadores");
  await expect(page.getByRole("heading", { name: "Utilizadores e papéis" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar e enviar convite" })).toHaveCount(0);
});

test("cookie de sessão é httpOnly e o logout termina a sessão no servidor", async ({
  page,
  context,
}) => {
  await entrarOk(page, conta("secretaria"));
  await expect(page).toHaveURL(/\/interno$/);
  const cookie = (await context.cookies()).find((c) => c.name.includes("lamanu_sessao"));
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const copia = { ...cookie! };
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  // Repor o cookie antigo (sessão revogada) não dá acesso.
  await context.addCookies([copia]);
  await page.goto("/interno");
  await expect(page).toHaveURL(/\/login$/);
});

test("admin técnico: cria utilizador, o convidado define a palavra-passe e entra; admin não se auto-altera", async ({
  page,
  browser,
}) => {
  await entrarOk(page, conta("admin.tecnico"));
  await page.goto("/interno/utilizadores");
  const email = `e2e-${Date.now()}@exemplo.lamanu.test`;
  const nova = page.locator("form", { hasText: "Novo utilizador" });
  await nova.getByPlaceholder("Nome").fill("Pessoa Convidada E2E");
  await nova.getByPlaceholder("Email").fill(email);
  await nova.getByLabel("Secretaria").check();
  await nova.getByRole("button", { name: "Criar e enviar convite" }).click();
  await expect(nova.getByRole("status")).toContainText("Utilizador criado");

  // O admin não pode alterar os próprios papéis (botão desactivado na sua linha).
  const minha = page.getByTestId(`utilizador-${conta("admin.tecnico")}`);
  await expect(minha.getByRole("button", { name: "Guardar papéis" })).toBeDisabled();
  await expect(minha.getByRole("button", { name: "Desactivar" })).toBeDisabled();

  // Convidado: lê o link no "email" de desenvolvimento e define a palavra-passe.
  const pasta = path.join(process.cwd(), "armazenamento", "dev-emails");
  const ficheiro = (await readdir(pasta))
    .filter((f) => f.includes(email.replace(/[^a-z0-9@.]/gi, "_")))
    .sort()
    .pop()!;
  const link = (await readFile(path.join(pasta, ficheiro), "utf8")).match(
    /https?:\/\/\S+\/redefinir\/\S+/,
  )![0]!;
  const ctx = await browser.newContext();
  const convidado = await ctx.newPage();
  await convidado.goto(link.replace(/^https?:\/\/[^/]+/, "http://localhost:3100"));
  await convidado.getByLabel("Nova palavra-passe (mínimo 10 caracteres)").fill("1234567890");
  await convidado.getByLabel("Repita a palavra-passe").fill("1234567890");
  await convidado.getByRole("button", { name: "Guardar" }).click();
  await expect(convidado.locator("main").getByRole("alert")).toBeVisible();
  const senhaNova = "Girafa-Verde-Lua-4821";
  await convidado.getByLabel("Nova palavra-passe (mínimo 10 caracteres)").fill(senhaNova);
  await convidado.getByLabel("Repita a palavra-passe").fill(senhaNova);
  await convidado.getByRole("button", { name: "Guardar" }).click();
  await expect(convidado).toHaveURL(/login\?redefinida=1/);
  await entrar(convidado, email, senhaNova);
  await expect(convidado).toHaveURL(/\/interno$/);
  await ctx.close();
});
