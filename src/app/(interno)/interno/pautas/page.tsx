import Link from "next/link";
import { exigirPermissao } from "@/server/auth/dal";
import { listarPautas } from "@/server/modules/pautas";

export const metadata = { title: "Pautas — Lá Manu" };

const COR: Record<string, string> = {
  RASCUNHO: "bg-slate-100",
  VALIDADA: "bg-amber-100",
  PUBLICADA: "bg-green-100",
};

export default async function Pautas() {
  const actor = await exigirPermissao("notas:ver");
  const pautas = await listarPautas(actor);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Pautas</h1>
      <ul className="space-y-2">
        {pautas.map((p) => (
          <li
            key={`${p.turmaId}:${p.periodoId}`}
            className="rounded border bg-white p-3"
            data-testid={`pauta-${p.turma}-${p.periodo}`}
          >
            <Link
              href={`/interno/pautas/${p.turmaId}/${p.periodoId}`}
              className="font-medium underline"
            >
              {p.turma} — {p.periodo}
            </Link>{" "}
            <span className="text-sm text-slate-600">({p.anoLectivo})</span>{" "}
            <span className={`rounded px-1 text-xs ${COR[p.estado] ?? ""}`}>{p.estado}</span>
          </li>
        ))}
        {pautas.length === 0 && (
          <li className="text-slate-600">Ainda não há avaliações lançadas.</li>
        )}
      </ul>
    </main>
  );
}
