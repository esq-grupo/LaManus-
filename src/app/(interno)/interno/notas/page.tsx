import Link from "next/link";
import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { exigirPermissao } from "@/server/auth/dal";
import { minhasDisciplinas } from "@/server/modules/avaliacao";
import { formatarData } from "@/lib/datas";
import { acaoAvaliacao } from "../acoes-avaliacao";

export const metadata = { title: "As minhas notas — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";
const TIPOS = [
  { valor: "TESTE", texto: "Teste" },
  { valor: "TRABALHO", texto: "Trabalho" },
  { valor: "EXAME", texto: "Exame" },
  { valor: "PARTICIPACAO", texto: "Participação" },
  { valor: "OUTRO", texto: "Outro" },
];

export default async function Notas() {
  const actor = await exigirPermissao("notas:lancar");
  const disciplinas = await minhasDisciplinas(actor);
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <h1 className="text-xl font-semibold">As minhas notas</h1>
      {disciplinas.length === 0 && (
        <p className="text-slate-600">
          Ainda não lhe foi atribuída nenhuma disciplina. Fale com a secretaria.
        </p>
      )}
      {disciplinas.map((td) => {
        const periodos = td.turma.anoLectivo.periodos.map((p) => ({
          valor: p.id,
          texto: `${p.nome} (${formatarData(p.inicio)} → ${formatarData(p.fim)})`,
        }));
        return (
          <section key={td.id} className={caixa} data-testid={`disciplina-${td.disciplina.nome}`}>
            <h2 className="font-medium">
              {td.disciplina.nome} — {td.turma.classe.nome} {td.turma.nome}{" "}
              <span className="text-sm text-slate-600">({td.turma.anoLectivo.nome})</span>
            </h2>
            <ul className="space-y-1 text-sm">
              {td.avaliacoes.map((a) => (
                <li key={a.id}>
                  <Link href={`/interno/notas/avaliacao/${a.id}`} className="underline">
                    {a.nome}
                  </Link>{" "}
                  · {a.periodo.nome} · peso {a.peso} · {formatarData(a.data)} · {a._count.notas}{" "}
                  nota(s)
                </li>
              ))}
              {td.avaliacoes.length === 0 && <li className="text-slate-600">Sem avaliações.</li>}
            </ul>
            {td.turma.anoLectivo.estado !== "FECHADO" && (
              <FormAcao
                acao={acaoAvaliacao}
                rotulo="Criar avaliação"
                className="space-y-2 border-t pt-2"
              >
                <h3 className="text-sm font-medium">Nova avaliação</h3>
                <input type="hidden" name="turmaDisciplinaId" value={td.id} />
                <Escolha nome="periodoId" rotulo="Período" opcoes={periodos} />
                <Escolha nome="tipo" rotulo="Tipo" opcoes={TIPOS} />
                <Campo nome="nome" rotulo="Nome (ex.: Teste 1)" obrigatorio />
                <Campo nome="peso" rotulo="Peso (1 a 100)" tipo="number" obrigatorio />
                <Campo nome="data" rotulo="Data" tipo="date" obrigatorio />
              </FormAcao>
            )}
          </section>
        );
      })}
    </main>
  );
}
