import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { formatarData } from "@/lib/datas";
import { NOMES_DECLARACAO, TIPOS_DECLARACAO } from "@/lib/declaracoes";
import { exigirArea } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { filaDePedidos } from "@/server/modules/declaracoes";
import { redirect } from "next/navigation";
import {
  acaoAprovarPedido,
  acaoEmitirDeclaracao,
  acaoPedirNaSecretaria,
  acaoRejeitarPedido,
} from "@/app/acoes-pedidos";

export const metadata = { title: "Pedidos de declarações — Lá Manu" };
const caixa = "space-y-2 rounded border bg-white p-3";

export default async function Pedidos() {
  const user = await exigirArea("interno");
  if (!can(user, "declaracoes:aprovar") && !can(user, "declaracoes:emitir"))
    redirect("/acesso-negado");
  const fila = await filaDePedidos(user);
  const decidir = can(user, "declaracoes:aprovar");
  const emitir = can(user, "declaracoes:emitir");
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <h1 className="text-xl font-semibold">Pedidos de declarações</h1>
      <section className={caixa} data-testid="fila-pedidos">
        <h2 className="font-medium">Por tratar ({fila.length})</h2>
        <ul className="space-y-2 text-sm">
          {fila.map((p) => (
            <li key={p.id} className="space-y-1 rounded border p-2" data-testid={`fila-${p.tipo}`}>
              <p>
                <strong>{NOMES_DECLARACAO[p.tipo]}</strong> · {p.estudante.nome} (processo{" "}
                {p.estudante.numeroProcesso}) · {formatarData(p.createdAt)} · «{p.finalidade}» ·{" "}
                <em>{p.estado === "PEDIDO" ? "por decidir" : "aprovado, por emitir"}</em>
              </p>
              {p.estado === "PEDIDO" && decidir && (
                <>
                  <FormAcao
                    acao={acaoAprovarPedido}
                    rotulo="Aprovar"
                    botaoClasse="min-h-11 rounded bg-slate-800 px-4 text-white disabled:opacity-50"
                  >
                    <input type="hidden" name="pedidoId" value={p.id} />
                  </FormAcao>
                  <FormAcao
                    acao={acaoRejeitarPedido}
                    rotulo="Rejeitar"
                    botaoClasse="min-h-11 rounded border px-4 disabled:opacity-50"
                  >
                    <input type="hidden" name="pedidoId" value={p.id} />
                    <Campo nome="motivo" rotulo="Motivo da rejeição" obrigatorio />
                  </FormAcao>
                </>
              )}
              {p.estado === "APROVADO" && emitir && (
                <FormAcao
                  acao={acaoEmitirDeclaracao}
                  rotulo="Emitir declaração"
                  botaoClasse="min-h-11 rounded bg-slate-800 px-4 text-white disabled:opacity-50"
                >
                  <input type="hidden" name="pedidoId" value={p.id} />
                </FormAcao>
              )}
            </li>
          ))}
          {fila.length === 0 && <li className="text-slate-600">Nada por tratar.</li>}
        </ul>
      </section>
      {emitir && (
        <section className={caixa}>
          <h2 className="font-medium">Registar um pedido feito na secretaria</h2>
          <FormAcao acao={acaoPedirNaSecretaria} rotulo="Registar pedido">
            <Campo nome="numeroProcesso" rotulo="N.º de processo do estudante" obrigatorio />
            <Escolha
              nome="tipo"
              rotulo="Tipo"
              opcoes={TIPOS_DECLARACAO.map((t) => ({ valor: t, texto: NOMES_DECLARACAO[t] }))}
            />
            <Campo nome="finalidade" rotulo="Finalidade" obrigatorio />
          </FormAcao>
        </section>
      )}
    </main>
  );
}
