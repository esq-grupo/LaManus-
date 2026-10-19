import { Campo, Escolha, FormAcao } from "@/components/FormAcao";
import { formatarData } from "@/lib/datas";
import { formatarNumeroDocumento, NOMES_DECLARACAO, TIPOS_DECLARACAO } from "@/lib/declaracoes";
import { acaoCancelarPedido, acaoPedirDeclaracao } from "@/app/acoes-pedidos";

const COR: Record<string, string> = {
  PEDIDO: "bg-amber-100",
  APROVADO: "bg-blue-100",
  REJEITADO: "bg-red-100",
  EMITIDA: "bg-green-100",
  CANCELADO: "bg-slate-200",
};
const TEXTO: Record<string, string> = {
  PEDIDO: "Por decidir",
  APROVADO: "Aprovado — a emitir",
  REJEITADO: "Rejeitado",
  EMITIDA: "Emitida",
  CANCELADO: "Cancelado",
};

export interface PedidoVista {
  id: string;
  tipo: string;
  finalidade: string;
  estado: string;
  createdAt: Date;
  motivoDecisao: string | null;
  estudante: { id: string; nome: string };
  emitida: { serie: string; ano: number; numero: number } | null;
}

/** Formulário de pedido + lista de pedidos dos educandos (portais). Mobile-first: cartões e alvos de toque grandes. */
export function PedidosPortal({
  educandos,
  pedidos,
}: {
  educandos: { id: string; nome: string }[];
  pedidos: PedidoVista[];
}) {
  return (
    <div className="space-y-5">
      {educandos.length > 0 && (
        <section className="space-y-2 rounded border bg-white p-3" aria-labelledby="h-novo">
          <h2 id="h-novo" className="text-lg font-semibold">
            Pedir uma declaração
          </h2>
          <FormAcao
            acao={acaoPedirDeclaracao}
            rotulo="Enviar pedido"
            botaoClasse="min-h-11 rounded bg-slate-800 px-4 text-white disabled:opacity-50"
          >
            <Escolha
              nome="estudanteId"
              rotulo="Para"
              opcoes={educandos.map((e) => ({ valor: e.id, texto: e.nome }))}
            />
            <Escolha
              nome="tipo"
              rotulo="Tipo"
              opcoes={TIPOS_DECLARACAO.map((t) => ({ valor: t, texto: NOMES_DECLARACAO[t] }))}
            />
            <Campo nome="finalidade" rotulo="Para que fim? (ex.: para a embaixada)" obrigatorio />
          </FormAcao>
        </section>
      )}
      <section className="space-y-2" aria-labelledby="h-pedidos">
        <h2 id="h-pedidos" className="text-lg font-semibold">
          Os meus pedidos
        </h2>
        <ul className="space-y-2" data-testid="pedidos">
          {pedidos.map((p) => (
            <li
              key={p.id}
              className="space-y-1 rounded border bg-white p-3 text-sm"
              data-testid={`pedido-${p.tipo}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {NOMES_DECLARACAO[p.tipo as keyof typeof NOMES_DECLARACAO]}
                  </p>
                  <p className="text-slate-600">
                    {p.estudante.nome} · {formatarData(p.createdAt)} · {p.finalidade}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-1 text-xs ${COR[p.estado]}`}
                  data-testid="estado-pedido"
                >
                  {TEXTO[p.estado]}
                </span>
              </div>
              {p.estado === "REJEITADO" && p.motivoDecisao && (
                <p className="text-red-700">Motivo: {p.motivoDecisao}</p>
              )}
              {p.estado === "EMITIDA" && p.emitida && (
                <a
                  className="inline-flex min-h-11 items-center rounded border px-4 underline"
                  href={`/declaracoes/${p.id}`}
                  data-testid="descarregar"
                >
                  Descarregar {formatarNumeroDocumento(p.emitida)}
                </a>
              )}
              {p.estado === "PEDIDO" && (
                <FormAcao
                  acao={acaoCancelarPedido}
                  rotulo="Cancelar pedido"
                  botaoClasse="min-h-11 rounded border px-4 disabled:opacity-50"
                >
                  <input type="hidden" name="pedidoId" value={p.id} />
                </FormAcao>
              )}
            </li>
          ))}
          {pedidos.length === 0 && (
            <li className="text-sm text-slate-600">Ainda não fez nenhum pedido.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
