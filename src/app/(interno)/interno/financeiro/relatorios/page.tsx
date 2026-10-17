import Link from "next/link";
import { formatarKz } from "@/lib/dinheiro";
import { hojeEmLuanda } from "@/lib/datas";
import { exigirPermissao } from "@/server/auth/dal";
import { veFinanceiroCompleto } from "@/server/authz/scope";
import { db } from "@/server/db";
import { dividasPorTurma, reconciliar, recebimentosPorPeriodo } from "@/server/modules/financeiro";
import { redirect } from "next/navigation";
import { ErroValidacao } from "@/server/erros";

export const metadata = { title: "Relatórios financeiros — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Relatorios({
  searchParams,
}: {
  searchParams: Promise<{ turma?: string; de?: string; ate?: string }>;
}) {
  const actor = await exigirPermissao("relatorios:ver");
  if (!veFinanceiroCompleto(actor)) redirect("/acesso-negado");
  const { turma, de, ate } = await searchParams;
  const hoje = hojeEmLuanda().toISOString().slice(0, 10);
  const turmas = await db.turma.findMany({
    where: { archivedAt: null },
    orderBy: [{ anoLectivo: { inicio: "desc" } }, { classe: { ordem: "asc" } }, { nome: "asc" }],
    include: { classe: true, anoLectivo: true },
    take: 200,
  });
  const dividas = turma ? await dividasPorTurma(actor, turma).catch(() => null) : null;
  let recebimentos = null;
  let erroPeriodo = "";
  if (de && ate) {
    try {
      recebimentos = await recebimentosPorPeriodo(actor, { de, ate });
    } catch (e) {
      if (e instanceof ErroValidacao) erroPeriodo = e.erros.join(" ");
      else throw e;
    }
  }
  const violacoes = await reconciliar(actor);

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <p className="text-sm">
        <Link href="/interno/financeiro" className="underline">
          ← Financeiro
        </Link>
      </p>
      <h1 className="text-xl font-semibold">Relatórios financeiros</h1>

      <section className={caixa} data-testid="rel-dividas">
        <h2 className="font-medium">Dívidas por turma</h2>
        <form className="flex gap-2">
          <select
            name="turma"
            defaultValue={turma ?? ""}
            className="w-full rounded border bg-white p-2"
          >
            <option value="">Escolha a turma…</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.classe.nome} {t.nome} — {t.anoLectivo.nome}
              </option>
            ))}
          </select>
          <button className="rounded border px-3">Ver</button>
        </form>
        {dividas && (
          <>
            <p className="text-sm">
              Total em dívida: <strong>{formatarKz(dividas.totalEmDivida)}</strong> · em atraso:{" "}
              <strong>{formatarKz(dividas.totalVencido)}</strong>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th>Estudante</th>
                  <th>Em dívida</th>
                  <th>Em atraso</th>
                </tr>
              </thead>
              <tbody>
                {dividas.linhas.map((l) => (
                  <tr key={l.estudanteId} className="border-t">
                    <td>
                      <Link
                        className="underline"
                        href={`/interno/financeiro/estudante/${l.estudanteId}`}
                      >
                        {l.nome}
                      </Link>
                    </td>
                    <td>{formatarKz(l.emDivida)}</td>
                    <td>{formatarKz(l.vencido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className={caixa} data-testid="rel-recebimentos">
        <h2 className="font-medium">Recebimentos por período</h2>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            De
            <input
              type="date"
              name="de"
              defaultValue={de ?? hoje}
              className="ml-1 rounded border p-2"
            />
          </label>
          <label className="text-sm">
            Até
            <input
              type="date"
              name="ate"
              defaultValue={ate ?? hoje}
              className="ml-1 rounded border p-2"
            />
          </label>
          <button className="rounded border px-3 py-2">Ver</button>
        </form>
        {erroPeriodo && (
          <p role="alert" className="text-sm text-red-700">
            {erroPeriodo}
          </p>
        )}
        {recebimentos && (
          <>
            <p className="text-sm">
              Bruto {formatarKz(recebimentos.bruto)} · estornado{" "}
              {formatarKz(recebimentos.estornado)} · líquido{" "}
              <strong data-testid="liquido">{formatarKz(recebimentos.liquido)}</strong>
            </p>
            <ul className="text-sm">
              {recebimentos.porMetodo.map((m) => (
                <li key={m.metodo}>
                  {m.metodo}: {formatarKz(m.bruto)} ({String(m.quantidade)} pagamentos)
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={caixa}>
        <h2 className="font-medium">Verificação das contas</h2>
        {violacoes.length === 0 ? (
          <p className="text-sm text-green-700" data-testid="reconciliacao-ok">
            Contas coerentes: nenhuma divergência encontrada.
          </p>
        ) : (
          <ul className="text-sm text-red-700" role="alert">
            {violacoes.map((v) => (
              <li key={`${v.verificacao}-${v.entidade_id}`}>
                {v.verificacao}: {v.detalhe}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
