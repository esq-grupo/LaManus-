import {
  LinhaUtilizadorForm,
  NovoUtilizador,
  type LinhaUtilizador,
} from "@/components/GestaoUtilizadores";

export function GestaoUtilizadoresLista({
  utilizadores,
  actorId,
  podeGerir,
}: {
  utilizadores: LinhaUtilizador[];
  actorId: string;
  podeGerir: boolean;
}) {
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Utilizadores e papéis</h1>
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
