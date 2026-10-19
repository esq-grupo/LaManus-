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
          <ul className="mt-2 divide-y text-sm">
            {p.disciplinas.map((d) => (
              <li key={d.disciplinaId} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">{d.disciplina}</p>
                  <p className="text-slate-600">
                    {d.avaliacoes.map((a) => `${a.nome}: ${formatarNota(a.valor)}`).join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-base font-semibold" aria-label="Média">
                  {d.media ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
