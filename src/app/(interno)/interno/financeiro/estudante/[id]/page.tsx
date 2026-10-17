import Link from "next/link";
import { notFound } from "next/navigation";
import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { ExtractoFinanceiro } from "@/components/ExtractoFinanceiro";
import { formatarData } from "@/lib/datas";
import { formatarKz } from "@/lib/dinheiro";
import { exigirPermissao } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { veFinanceiroCompleto } from "@/server/authz/scope";
import { db } from "@/server/db";
import { extractoDoEstudante } from "@/server/modules/financeiro";
import { ErroAutorizacao } from "@/server/erros";
import {
  acaoAlocarManual,
  acaoAnularEncargo,
  acaoAnularPagamento,
  acaoConfirmarPagamento,
  acaoCriarEncargo,
  acaoProporEstorno,
  acaoRegistarPagamento,
} from "../../../acoes-financeiro";

export const metadata = { title: "Contas do estudante — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Contas({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermissao("financeiro:ver");
  if (!veFinanceiroCompleto(actor)) notFound();
  const { id } = await params;
  let extracto;
  try {
    extracto = await extractoDoEstudante(actor, id);
  } catch (e) {
    if (e instanceof ErroAutorizacao) notFound();
    throw e;
  }
  const editar = can(actor, "financeiro:editar");
  const confirmar = can(actor, "pagamento:confirmar");
  const propor = can(actor, "estorno:propor");
  const [tipos, anos] = editar
    ? await Promise.all([
        db.tipoEncargo.findMany({ where: { activo: true }, orderBy: { nome: "asc" } }),
        db.anoLectivo.findMany({
          where: { estado: { not: "FECHADO" } },
          orderBy: { inicio: "desc" },
        }),
      ])
    : [[], []];
  const abertos = extracto.encargos.filter((e) => e.estado !== "ANULADO" && e.estado !== "PAGO");
  const opcEncargos = abertos.map((e) => ({
    valor: e.id,
    texto: `${e.descricao} (em falta ${formatarKz(e.valor - e.pago)})`,
  }));

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <p className="text-sm">
        <Link href="/interno/financeiro" className="underline">
          ← Financeiro
        </Link>
      </p>
      <h1 className="text-xl font-semibold">
        {extracto.estudante.nome}{" "}
        <span className="text-sm font-normal text-slate-600">
          · Processo {extracto.estudante.numeroProcesso}
        </span>
      </h1>
      <ExtractoFinanceiro extracto={extracto} />

      {editar && (
        <section className={caixa}>
          <h2 className="font-medium">Registar pagamento</h2>
          <FormAcao acao={acaoRegistarPagamento} rotulo="Registar pagamento">
            <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
            <Campo nome="valorKz" rotulo="Valor (Kz)" obrigatorio />
            <Escolha
              nome="metodo"
              rotulo="Método"
              opcoes={[
                { valor: "TRANSFERENCIA", texto: "Transferência" },
                { valor: "DEPOSITO", texto: "Depósito" },
                { valor: "TPA", texto: "Cartão (TPA)" },
                { valor: "NUMERARIO", texto: "Numerário" },
              ]}
            />
            <Campo nome="dataPagamento" rotulo="Data do pagamento" tipo="date" obrigatorio />
            <Campo nome="nomePagador" rotulo="Nome de quem pagou (opcional)" />
            <Campo nome="referenciaExterna" rotulo="Referência do banco/talão (opcional)" />
            <Escolha
              nome="modoAlocacao"
              rotulo="Aplicação do valor"
              opcoes={[
                { valor: "AUTOMATICO", texto: "Automática (encargo mais antigo primeiro)" },
                { valor: "MANUAL", texto: "Manual (escolho depois)" },
              ]}
            />
          </FormAcao>
        </section>
      )}

      <section className={caixa}>
        <h2 className="font-medium">Movimentos</h2>
        <ul className="space-y-2 text-sm">
          {extracto.pagamentos.map((p) => (
            <li key={p.id} className="space-y-1 rounded border p-2" data-testid={`mov-${p.id}`}>
              <p>
                {formatarData(p.dataPagamento)} · {formatarKz(p.valor)} ·{" "}
                <strong>{p.estado}</strong>
                {p.motivoAnulacao ? ` · «${p.motivoAnulacao}»` : ""}
              </p>
              {p.estornos.map((s) => (
                <p key={s.id} className="text-slate-600">
                  Estorno {s.estado.toLowerCase()} de {formatarKz(s.valor)} — «{s.motivo}»
                </p>
              ))}
              {p.estado === "REGISTADO" && confirmar && (
                <FormAcao acao={acaoConfirmarPagamento} rotulo="Confirmar e emitir recibo">
                  <input type="hidden" name="pagamentoId" value={p.id} />
                  <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
                </FormAcao>
              )}
              {p.estado === "REGISTADO" && editar && (
                <FormAcao acao={acaoAnularPagamento} rotulo="Anular registo">
                  <input type="hidden" name="pagamentoId" value={p.id} />
                  <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
                  <Campo nome="motivo" rotulo="Motivo da anulação" obrigatorio />
                </FormAcao>
              )}
              {p.estado === "CONFIRMADO" && editar && opcEncargos.length > 0 && (
                <FormAcao acao={acaoAlocarManual} rotulo="Alocar a um encargo">
                  <input type="hidden" name="pagamentoId" value={p.id} />
                  <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
                  <Escolha nome="encargoId" rotulo="Encargo" opcoes={opcEncargos} />
                  <Campo nome="valorKz" rotulo="Valor a alocar (Kz)" obrigatorio />
                </FormAcao>
              )}
              {p.estado === "CONFIRMADO" && propor && (
                <FormAcao acao={acaoProporEstorno} rotulo="Propor estorno">
                  <input type="hidden" name="pagamentoId" value={p.id} />
                  <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
                  <Campo nome="valorKz" rotulo="Valor a estornar (Kz)" obrigatorio />
                  <Campo nome="motivo" rotulo="Motivo" obrigatorio />
                </FormAcao>
              )}
            </li>
          ))}
        </ul>
      </section>

      {editar && (
        <section className={caixa}>
          <h2 className="font-medium">Novo encargo avulso</h2>
          <FormAcao acao={acaoCriarEncargo} rotulo="Criar encargo">
            <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
            <Escolha
              nome="tipoEncargoId"
              rotulo="Tipo"
              opcoes={tipos.map((t) => ({ valor: t.id, texto: t.nome }))}
            />
            <Escolha
              nome="anoLectivoId"
              rotulo="Ano lectivo"
              opcoes={anos.map((a) => ({ valor: a.id, texto: a.nome }))}
            />
            <Campo nome="referencia" rotulo="Referência (ex.: MATRICULA-2026)" obrigatorio />
            <Campo nome="valorKz" rotulo="Valor (Kz)" obrigatorio />
            <Campo nome="vencimento" rotulo="Vencimento" tipo="date" obrigatorio />
          </FormAcao>
          {abertos.length > 0 && (
            <FormAcao acao={acaoAnularEncargo} rotulo="Anular encargo">
              <input type="hidden" name="estudanteId" value={extracto.estudante.id} />
              <Escolha nome="encargoId" rotulo="Encargo a anular" opcoes={opcEncargos} />
              <Campo nome="motivo" rotulo="Motivo" obrigatorio />
            </FormAcao>
          )}
        </section>
      )}
    </main>
  );
}
