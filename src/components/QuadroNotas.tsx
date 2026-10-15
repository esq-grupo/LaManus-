import { formatarNota } from "@/lib/avaliacao";
import type { NotasDoEstudante } from "@/server/modules/notas-leitura";

/** Notas já PUBLICADAS (a consulta só devolve estas aos portais), por período e disciplina, com médias. */
export function QuadroNotas({ notas }: { notas: NotasDoEstudante }) {
  if (notas.periodos.length === 0) {
    return (
      <p className="text-sm text-slate-600" data-testid="sem-notas">
        Ainda não há notas publicadas.
      </p>
    );
  }
  return (
    <div className="space-y-4" data-testid="quadro-notas">
      {notas.periodos.map((p) => (
        <section key={p.periodoId} className="rounded border bg-white p-3">
          <h3 className="font-medium">
            {p.periodo}{" "}
            <span className="text-sm text-slate-600">· média geral {p.mediaGeral ?? "—"}</span>
          </h3>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-1">Disciplina</th>
                <th className="p-1">Avaliações</th>
                <th className="p-1">Média</th>
              </tr>
            </thead>
            <tbody>
              {p.disciplinas.map((d) => (
                <tr key={d.disciplinaId} className="border-t">
                  <td className="p-1">{d.disciplina}</td>
                  <td className="p-1">
                    {d.avaliacoes.map((a) => `${a.nome}: ${formatarNota(a.valor)}`).join(" · ")}
                  </td>
                  <td className="p-1 font-medium">{d.media ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
