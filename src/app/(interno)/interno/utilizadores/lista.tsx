import {
  LinhaUtilizadorForm,
  NovoUtilizador,
  type LinhaUtilizador,
} from "@/components/GestaoUtilizadores";

export function GestaoUtilizadoresLista({
  q,
  total,
  utilizadores,
  actorId,
  podeGerir,
}: {
  q: string;
  total: number;
  utilizadores: LinhaUtilizador[];
  actorId: string;
  podeGerir: boolean;
}) {
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
        {total > utilizadores.length
          ? `A mostrar ${utilizadores.length} de ${total} utilizadores — use a pesquisa para encontrar os restantes.`
          : `${total} utilizador(es).`}
      </p>
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
