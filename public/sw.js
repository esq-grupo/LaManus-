/* Service worker da Lá Manu — DELIBERADAMENTE MÍNIMO (segurança e privacidade).
 *
 * Só serve para a aplicação ser instalável e mostrar uma página simples quando não há ligação.
 * NÃO guarda em cache notas, contas, recibos, declarações nem qualquer página autenticada: as únicas coisas
 * guardadas são a página pública /offline. Todos os outros pedidos passam directamente para a rede.
 */
const CACHE = "lamanu-offline-v1";
const OFFLINE = "/offline";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(OFFLINE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Só navegações (abrir uma página). Tudo o resto (dados, PDFs, acções) vai à rede, sem cache.
  if (pedido.mode !== "navigate") return;
  evento.respondWith(
    fetch(pedido).catch(() =>
      caches
        .open(CACHE)
        .then((c) => c.match(OFFLINE))
        .then((r) => r || Response.error()),
    ),
  );
});
