import { formatarData } from "@/lib/datas";
import { formatarKz } from "@/lib/dinheiro";
import { formatarNumeroRecibo, type EstadoEncargo } from "@/lib/financeiro";

const COR: Record<EstadoEncargo, string> = {
  PAGO: "bg-green-100",
  PARCIAL: "bg-amber-100",
  PENDENTE: "bg-slate-100",
  VENCIDO: "bg-red-100",
  ANULADO: "bg-slate-200 line-through",
};

export interface DadosExtracto {
  saldo: { encargos: bigint; pago: bigint; emDivida: bigint; vencido: bigint; credito: bigint };
  encargos: {
    id: string;
    descricao: string;
    valor: bigint;
    pago: bigint;
    vencimento: Date;
    estado: EstadoEncargo;
  }[];
  pagamentos: {
    id: string;
    valor: bigint;
    estado: string;
    dataPagamento: Date;
    recibo: { serie: string; ano: number; numero: number } | null;
  }[];
}

/** Extracto só de leitura (portais e ficha interna). Os valores são calculados no servidor. */
export function ExtractoFinanceiro({ extracto }: { extracto: DadosExtracto }) {
  const { saldo } = extracto;
  return (
    <section className="space-y-3" data-testid="extracto">
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded border bg-white p-2">
          <dt className="text-slate-600">Em dívida</dt>
          <dd className="font-semibold" data-testid="em-divida">
            {formatarKz(saldo.emDivida)}
          </dd>
        </div>
        <div className="rounded border bg-white p-2">
          <dt className="text-slate-600">Em atraso</dt>
          <dd className="font-semibold" data-testid="vencido">
            {formatarKz(saldo.vencido)}
          </dd>
        </div>
        <div className="rounded border bg-white p-2">
          <dt className="text-slate-600">Pago</dt>
          <dd className="font-semibold">{formatarKz(saldo.pago)}</dd>
        </div>
        <div className="rounded border bg-white p-2">
          <dt className="text-slate-600">Crédito</dt>
          <dd className="font-semibold" data-testid="credito">
            {formatarKz(saldo.credito)}
          </dd>
        </div>
      </dl>
      <h3 className="font-medium">Encargos</h3>
      <ul className="divide-y rounded border bg-white text-sm">
        {extracto.encargos.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-3 p-3"
            data-testid={`encargo-${e.descricao}`}
          >
            <div>
              <p className="font-medium">{e.descricao}</p>
              <p className="text-slate-600">
                Vence em {formatarData(e.vencimento)} · pago {formatarKz(e.pago)} de{" "}
                {formatarKz(e.valor)}
              </p>
            </div>
            <span className={`shrink-0 rounded px-2 py-1 text-xs ${COR[e.estado]}`}>
              {e.estado}
            </span>
          </li>
        ))}
        {extracto.encargos.length === 0 && <li className="p-3 text-slate-600">Sem encargos.</li>}
      </ul>
      <h3 className="font-medium">Pagamentos</h3>
      <ul className="divide-y rounded border bg-white text-sm">
        {extracto.pagamentos.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 p-3">
            <div>
              <p className="font-medium">{formatarKz(p.valor)}</p>
              <p className="text-slate-600">
                {formatarData(p.dataPagamento)} · {p.estado}
              </p>
            </div>
            {p.recibo ? (
              <a
                className="shrink-0 rounded border px-3 py-2 underline"
                href={`/recibos/${p.id}`}
                data-testid="recibo"
              >
                Recibo {formatarNumeroRecibo(p.recibo)}
              </a>
            ) : (
              <span className="shrink-0 text-slate-500">sem recibo</span>
            )}
          </li>
        ))}
        {extracto.pagamentos.length === 0 && (
          <li className="p-3 text-slate-600">Sem pagamentos.</li>
        )}
      </ul>
    </section>
  );
}
