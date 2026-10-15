import { notFound } from "next/navigation";
import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { exigirPermissao } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { obterPauta } from "@/server/modules/pautas";
import { formatarNota } from "@/lib/avaliacao";
import { formatarData } from "@/lib/datas";
import {
  acaoCorrigirNota,
  acaoPublicarPauta,
  acaoReabrirPauta,
  acaoValidarPauta,
} from "../../../acoes-avaliacao";

export const metadata = { title: "Pauta — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Pauta({
  params,
}: {
  params: Promise<{ turmaId: string; periodoId: string }>;
}) {
  const actor = await exigirPermissao("notas:ver");
  const { turmaId, periodoId } = await params;
  const p = await obterPauta(actor, turmaId, periodoId);
  if (!p) notFound(); // inexistente ou fora do escopo: a mesma resposta
  const gere = can(actor, "pauta:publicar");
  const corrige = can(actor, "notas:corrigir") && p.estado === "PUBLICADA";

  const opcoesCorrecao = p.linhas.flatMap((l) =>
    l.notas.flatMap((n) => {
      if (!n.notaId || n.valor === null) return [];
      const a = p.avaliacoes.find((x) => x.id === n.avaliacaoId);
      return [
        {
          valor: n.notaId,
          texto: `${l.nome} — ${a?.nome ?? "?"} (actual ${formatarNota(n.valor)})`,
        },
      ];
    }),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">
        Pauta — {p.turma} — {p.periodo}
      </h1>
      <p className="text-sm text-slate-600">
        {p.anoLectivo} · Estado: <strong data-testid="estado-pauta">{p.estado}</strong>
        {p.validadaEm ? ` · validada em ${formatarData(p.validadaEm)}` : ""}
        {p.publicadaEm ? ` · publicada em ${formatarData(p.publicadaEm)}` : ""}
      </p>
      {p.emFalta.length > 0 && (
        <p role="status" className="rounded bg-amber-50 p-2 text-sm text-amber-900">
          Notas por lançar: {p.emFalta.map((f) => `${f.avaliacao} (${f.em_falta})`).join("; ")}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="p-1">Estudante</th>
              {p.avaliacoes.map((a) => (
                <th key={a.id} className="p-1">
                  {a.nome} <span className="font-normal text-slate-500">(peso {a.peso})</span>
                </th>
              ))}
              {p.disciplinas.map((d) => (
                <th key={d.id} className="p-1">
                  Média {d.nome}
                </th>
              ))}
              <th className="p-1">Média geral</th>
            </tr>
          </thead>
          <tbody>
            {p.linhas.map((l) => (
              <tr key={l.estudanteId} className="border-t" data-testid={`linha-${l.nome}`}>
                <td className="p-1">{l.nome}</td>
                {l.notas.map((n) => (
                  <td key={n.avaliacaoId} className="p-1">
                    {n.valor === null ? "—" : formatarNota(n.valor)}
                  </td>
                ))}
                {l.medias.map((m) => (
                  <td key={m.disciplinaId} className="p-1">
                    {m.media ?? "—"}
                  </td>
                ))}
                <td className="p-1 font-medium">{l.mediaGeral ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Médias: ponderadas pelos pesos, uma casa decimal, arredondamento «meio para cima» (fórmula
        provisória — D4).
      </p>

      {gere && (
        <section className="grid gap-3 sm:grid-cols-2" aria-label="Acções da pauta">
          {p.estado === "RASCUNHO" && (
            <FormAcao acao={acaoValidarPauta} rotulo="Validar pauta" className={caixa}>
              <p className="text-sm">
                Exige todas as notas lançadas. Depois de validada, o docente já não pode alterar
                notas.
              </p>
              <input type="hidden" name="turmaId" value={turmaId} />
              <input type="hidden" name="periodoId" value={periodoId} />
            </FormAcao>
          )}
          {p.estado === "VALIDADA" && (
            <>
              <FormAcao acao={acaoPublicarPauta} rotulo="Publicar pauta" className={caixa}>
                <p className="text-sm">
                  A partir daqui estudantes e encarregados passam a ver estas notas.
                </p>
                <input type="hidden" name="turmaId" value={turmaId} />
                <input type="hidden" name="periodoId" value={periodoId} />
              </FormAcao>
              <FormAcao
                acao={acaoReabrirPauta}
                rotulo="Reabrir pauta"
                className={caixa}
                botaoClasse="rounded border border-red-700 px-3 py-1 text-sm text-red-700 disabled:opacity-50"
              >
                <input type="hidden" name="turmaId" value={turmaId} />
                <input type="hidden" name="periodoId" value={periodoId} />
                <Campo nome="motivo" rotulo="Motivo (obrigatório)" obrigatorio />
              </FormAcao>
            </>
          )}
        </section>
      )}
      {corrige && opcoesCorrecao.length > 0 && (
        <FormAcao acao={acaoCorrigirNota} rotulo="Corrigir nota" className={caixa}>
          <h2 className="font-medium">Corrigir uma nota publicada</h2>
          <p className="text-sm text-slate-600">
            Fica registado quem corrigiu, o valor anterior, o novo e o motivo.
          </p>
          <input type="hidden" name="turmaId" value={turmaId} />
          <input type="hidden" name="periodoId" value={periodoId} />
          <Escolha nome="notaId" rotulo="Nota" opcoes={opcoesCorrecao} />
          <Campo nome="valor" rotulo="Novo valor (0 a 20)" obrigatorio />
          <Campo nome="motivo" rotulo="Motivo (obrigatório)" obrigatorio />
        </FormAcao>
      )}
    </main>
  );
}
