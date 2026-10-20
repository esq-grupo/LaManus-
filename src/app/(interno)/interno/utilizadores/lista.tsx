import {
  LinhaUtilizadorForm,
  NovoUtilizador,
  type LinhaUtilizador,
} from "@/components/GestaoUtilizadores";

export function GestaoUtilizadoresLista({
  q,
  total,
  pagina,
  paginas,
  de,
  ate,
  utilizadores,
  actorId,
  podeGerir,
}: {
  q: string;
  total: number;
  pagina: number;
  paginas: number;
  de: number;
  ate: number;
  utilizadores: LinhaUtilizador[];
  actorId: string;
  podeGerir: boolean;
}) {
  const hrefPagina = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("pagina", String(n));
    return `/interno/utilizadores?${params.toString()}`;
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Utilizadores e papéis</h1>
      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Pesquisar por nome ou email"
          aria-label="Pesquisar utilizadores"
          className="w-full rounded border p-2"
        />
        <button className="rounded bg-slate-800 px-3 text-white">Pesquisar</button>
      </form>
      <p className="text-sm text-slate-600" data-testid="contagem-utilizadores">
        {`A mostrar ${de}–${ate} de ${total} utilizadores`}
      </p>
      <p className="text-sm text-slate-600" data-testid="pagina-utilizadores">
        Página {pagina} de {paginas}
      </p>
      <nav aria-label="Navegação de páginas" className="flex flex-wrap gap-2">
        {pagina > 1 ? (
          <a
            href={hrefPagina(pagina - 1)}
            className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded border px-3"
          >
            Anterior
          </a>
        ) : null}
        {pagina < paginas ? (
          <a
            href={hrefPagina(pagina + 1)}
            className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded border px-3"
          >
            Seguinte
          </a>
        ) : null}
      </nav>
      {podeGerir ? (
        <>
          <NovoUtilizador />
          <ul className="space-y-3">
            {utilizadores.map((u) => (
              <LinhaUtilizadorForm key={u.id} u={u} euProprio={u.id === actorId} />
            ))}
          </ul>
        </>
      ) : (
        <ul className="space-y-1">
          {utilizadores.map((u) => (
            <li key={u.id} className="rounded border bg-white p-2 text-sm">
              {u.nome} — {u.email} — {u.papeis.join(", ")} ({u.estado})
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
