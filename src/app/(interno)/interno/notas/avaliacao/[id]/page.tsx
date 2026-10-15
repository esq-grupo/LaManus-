import { notFound } from "next/navigation";
import { FormAcao } from "@/components/FormAcao";
import { exigirPermissao, ipDoPedido } from "@/server/auth/dal";
import { grelhaDeLancamento } from "@/server/modules/avaliacao";
import { formatarNota } from "@/lib/avaliacao";
import { acaoNotas } from "../../../acoes-avaliacao";

export const metadata = { title: "Lançar notas — Lá Manu" };

export default async function Lancar({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermissao("notas:lancar");
  const { id } = await params;
  const g = await grelhaDeLancamento(actor, id, await ipDoPedido());
  if (!g) notFound();
  const aberta = g.estadoPauta === "RASCUNHO";
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{g.avaliacao.nome}</h1>
      <p className="text-sm text-slate-600">
        {g.disciplina} · {g.turma} · {g.avaliacao.periodo} · peso {g.avaliacao.peso}
      </p>
      {!aberta && (
        <p role="status" className="rounded bg-amber-50 p-2 text-sm text-amber-900">
          A pauta deste período está {g.estadoPauta === "VALIDADA" ? "validada" : "publicada"}: já
          não aceita alterações. Peça à Direcção para a reabrir (ou corrigir, se estiver publicada).
        </p>
      )}
      <FormAcao acao={acaoNotas} rotulo="Guardar notas" className="space-y-2">
        <input type="hidden" name="avaliacaoId" value={g.avaliacao.id} />
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-1">Estudante</th>
              <th className="p-1">Processo</th>
              <th className="p-1">Nota (0 a 20)</th>
            </tr>
          </thead>
          <tbody>
            {g.estudantes.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-1">{e.nome}</td>
                <td className="p-1">{e.numeroProcesso}</td>
                <td className="p-1">
                  <input
                    name={`nota-${e.id}`}
                    aria-label={`Nota de ${e.nome}`}
                    inputMode="decimal"
                    defaultValue={e.valor === null ? "" : formatarNota(e.valor)}
                    disabled={!aberta}
                    className="w-24 rounded border p-1 disabled:bg-slate-100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {g.estudantes.length === 0 && (
          <p className="text-slate-600">A turma não tem estudantes com matrícula activa.</p>
        )}
      </FormAcao>
    </main>
  );
}
