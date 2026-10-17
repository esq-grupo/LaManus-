import Link from "next/link";
import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { formatarData } from "@/lib/datas";
import { formatarKz } from "@/lib/dinheiro";
import { exigirPermissao } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { veFinanceiroCompleto } from "@/server/authz/scope";
import { db } from "@/server/db";
import {
  estornosPorDecidir,
  listarTipos,
  pagamentosPorConfirmar,
  procurarEstudantes,
} from "@/server/modules/financeiro";
import {
  acaoAnularPagamento,
  acaoAprovarEstorno,
  acaoConfirmarPagamento,
  acaoCriarTipo,
  acaoGerarPropinas,
  acaoRejeitarEstorno,
} from "../acoes-financeiro";
import { redirect } from "next/navigation";

export const metadata = { title: "Financeiro — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Financeiro({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await exigirPermissao("financeiro:ver");
  if (!veFinanceiroCompleto(actor)) redirect("/acesso-negado");
  const { q = "" } = await searchParams;
  const editar = can(actor, "financeiro:editar");
  const confirmar = can(actor, "pagamento:confirmar");
  const decidir = can(actor, "estorno:aprovar");

  const [tipos, porConfirmar, estornos, encontrados, anos] = await Promise.all([
    listarTipos(actor),
    pagamentosPorConfirmar(actor),
    estornosPorDecidir(actor),
    procurarEstudantes(actor, q),
    editar
      ? db.anoLectivo.findMany({
          where: { estado: { not: "FECHADO" } },
          orderBy: { inicio: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <h1 className="text-xl font-semibold">Financeiro</h1>
      <p className="text-sm">
        <Link href="/interno/financeiro/relatorios" className="underline">
          Relatórios
        </Link>
      </p>

      <section className={caixa}>
        <h2 className="font-medium">Procurar estudante</h2>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome ou n.º de processo"
            className="w-full rounded border p-2"
          />
          <button className="rounded border px-3">Procurar</button>
        </form>
        <ul className="text-sm">
          {encontrados.map((e) => (
            <li key={e.id}>
              <Link className="underline" href={`/interno/financeiro/estudante/${e.id}`}>
                {e.nome}
              </Link>{" "}
              <span className="text-slate-600">· Processo {e.numeroProcesso}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={caixa} data-testid="por-confirmar">
        <h2 className="font-medium">Pagamentos por confirmar ({porConfirmar.length})</h2>
        {porConfirmar.length === 0 && <p className="text-sm text-slate-600">Nada por confirmar.</p>}
        <ul className="space-y-2 text-sm">
          {porConfirmar.map((p) => (
            <li key={p.id} className="space-y-1 rounded border p-2" data-testid={`pag-${p.id}`}>
              <p>
                <Link className="underline" href={`/interno/financeiro/estudante/${p.estudanteId}`}>
                  {p.estudante.nome}
                </Link>{" "}
                · {formatarKz(p.valor)} · {formatarData(p.dataPagamento)} · {p.metodo}
                {p.referenciaExterna ? ` · ref. ${p.referenciaExterna}` : ""}
              </p>
              {confirmar && (
                <FormAcao
                  acao={acaoConfirmarPagamento}
                  rotulo="Confirmar e emitir recibo"
                  className="inline"
                >
                  <input type="hidden" name="pagamentoId" value={p.id} />
                  <input type="hidden" name="estudanteId" value={p.estudanteId} />
                </FormAcao>
              )}
              {editar && (
                <FormAcao acao={acaoAnularPagamento} rotulo="Anular registo" className="space-y-1">
                  <input type="hidden" name="pagamentoId" value={p.id} />
                  <input type="hidden" name="estudanteId" value={p.estudanteId} />
                  <Campo nome="motivo" rotulo="Motivo da anulação" obrigatorio />
                </FormAcao>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={caixa} data-testid="estornos-por-decidir">
        <h2 className="font-medium">Estornos por decidir ({estornos.length})</h2>
        <ul className="space-y-2 text-sm">
          {estornos.map((s) => (
            <li key={s.id} className="space-y-1 rounded border p-2">
              <p>
                {s.pagamento.estudante.nome} · estornar {formatarKz(s.valor)} de{" "}
                {formatarKz(s.pagamento.valor)} · «{s.motivo}»
              </p>
              {decidir && (
                <>
                  <FormAcao
                    acao={acaoAprovarEstorno}
                    rotulo="Aprovar estorno"
                    className="space-y-1"
                  >
                    <input type="hidden" name="estornoId" value={s.id} />
                    <input type="hidden" name="estudanteId" value={s.pagamento.estudanteId} />
                    <Campo nome="motivo" rotulo="Nota (opcional)" />
                  </FormAcao>
                  <FormAcao acao={acaoRejeitarEstorno} rotulo="Rejeitar" className="space-y-1">
                    <input type="hidden" name="estornoId" value={s.id} />
                    <input type="hidden" name="estudanteId" value={s.pagamento.estudanteId} />
                    <Campo nome="motivo" rotulo="Motivo da rejeição" obrigatorio />
                  </FormAcao>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={caixa}>
        <h2 className="font-medium">Tipos de encargo</h2>
        <ul className="text-sm">
          {tipos.map((t) => (
            <li key={t.id}>
              {t.nome} · {formatarKz(t.valorReferencia)} · {t.periodicidade}
              {t.activo ? "" : " (desactivado)"}
            </li>
          ))}
        </ul>
        {editar && (
          <FormAcao acao={acaoCriarTipo} rotulo="Criar tipo">
            <Campo nome="nome" rotulo="Nome (ex.: Propina mensal)" obrigatorio />
            <Campo nome="valorKz" rotulo="Valor de referência (Kz)" obrigatorio />
            <Escolha
              nome="periodicidade"
              rotulo="Periodicidade"
              opcoes={[
                { valor: "MENSAL", texto: "Mensal" },
                { valor: "ANUAL", texto: "Anual" },
                { valor: "UNICO", texto: "Único" },
              ]}
            />
          </FormAcao>
        )}
      </section>

      {editar && (
        <section className={caixa}>
          <h2 className="font-medium">Gerar propinas do mês</h2>
          <p className="text-sm text-slate-600">
            Cria uma propina por estudante com matrícula activa no ano lectivo. Repetir não duplica.
          </p>
          <FormAcao acao={acaoGerarPropinas} rotulo="Gerar propinas">
            <Escolha
              nome="tipoEncargoId"
              rotulo="Tipo (mensal)"
              opcoes={tipos
                .filter((t) => t.activo && t.periodicidade === "MENSAL")
                .map((t) => ({ valor: t.id, texto: t.nome }))}
            />
            <Escolha
              nome="anoLectivoId"
              rotulo="Ano lectivo"
              opcoes={anos.map((a) => ({ valor: a.id, texto: a.nome }))}
            />
            <Campo nome="referencia" rotulo="Mês (AAAA-MM)" placeholder="2026-10" obrigatorio />
            <Campo nome="diaVencimento" rotulo="Dia de vencimento (1–28)" defaultValue="5" />
          </FormAcao>
        </section>
      )}
    </main>
  );
}
