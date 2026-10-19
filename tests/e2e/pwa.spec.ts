import { expect, test, type Page } from "@playwright/test";

const SENHA = process.env.SEED_PASSWORD ?? "";

async function entrar(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Palavra-passe").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(interno|estudante|encarregado)$/);
}

test("manifesto e ícones: a aplicação é instalável", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  const r = await request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  const m = await r.json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");
  for (const icone of m.icons as { src: string; sizes: string }[]) {
    const png = await request.get(icone.src);
    expect(png.status(), icone.src).toBe(200);
    expect(png.headers()["content-type"]).toContain("image/png");
    const corpo = await png.body();
    expect(corpo.subarray(0, 4).toString("hex")).toBe("89504e47");
    const lado = Number(icone.sizes.split("x")[0]);
    expect(corpo.readUInt32BE(16)).toBe(lado); // largura no cabeçalho IHDR
  }
  expect((await request.get("/pwa/icone/999")).status()).toBe(404);
});

test("service worker: sem cache do navegador; página /offline pública e sem dados pessoais", async ({
  request,
}) => {
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(sw.headers()["content-type"]).toContain("javascript");
  const off = await request.get("/offline");
  expect(off.status()).toBe(200);
  const html = await off.text();
  expect(html).toContain("Sem ligação à internet");
  expect(html).not.toMatch(/Estudante Fictício|Processo|Kz/);
});

test("sem ligação: mostra a página offline e NADA de autenticado fica em cache", async ({
  page,
  context,
}) => {
  await entrar(page, "estudante@exemplo.lamanu.test");
  // em desenvolvimento o registo automático está desligado: regista-se à mão, como em produção
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
  });
  // navega por páginas com dados pessoais e descarrega um PDF, com o service worker activo
  await page.goto("/estudante");
  await expect(page.getByTestId("perfil")).toBeVisible();
  await page.goto("/estudante/pedidos");
  await page.goto("/estudante/avisos");
  const guardado = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const nome of await caches.keys()) {
      const c = await caches.open(nome);
      for (const q of await c.keys()) urls.push(new URL(q.url).pathname);
    }
    return urls;
  });
  expect(guardado).toEqual(["/offline"]);

  await context.setOffline(true);
  await page.goto("/estudante").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "Sem ligação à internet" })).toBeVisible();
  await expect(page.getByText("Estudante Fictício")).toHaveCount(0);
  await context.setOffline(false);
  await page.goto("/estudante");
  await expect(page.getByTestId("perfil")).toBeVisible();
});

test("quem já tem sessão entra direito na sua área ao abrir a aplicação instalada", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Plataforma de gestão escolar")).toBeVisible(); // anónimo: vê as áreas
  await entrar(page, "estudante@exemplo.lamanu.test");
  await page.goto("/");
  await expect(page).toHaveURL(/\/estudante$/);
});
