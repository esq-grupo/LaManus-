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
      <table className="w-full text-sm">
        <caption className="text-left font-medium">Encargos</caption>
        <thead>
          <tr className="text-left text-slate-600">
            <th>Descrição</th>
            <th>Vencimento</th>
            <th>Valor</th>
            <th>Pago</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {extracto.encargos.map((e) => (
            <tr key={e.id} className="border-t" data-testid={`encargo-${e.descricao}`}>
              <td>{e.descricao}</td>
              <td>{formatarData(e.vencimento)}</td>
              <td>{formatarKz(e.valor)}</td>
              <td>{formatarKz(e.pago)}</td>
              <td>
                <span className={`rounded px-1 text-xs ${COR[e.estado]}`}>{e.estado}</span>
              </td>
            </tr>
          ))}
          {extracto.encargos.length === 0 && (
            <tr>
              <td colSpan={5} className="text-slate-600">
                Sem encargos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <table className="w-full text-sm">
        <caption className="text-left font-medium">Pagamentos</caption>
        <thead>
          <tr className="text-left text-slate-600">
            <th>Data</th>
            <th>Valor</th>
            <th>Estado</th>
            <th>Recibo</th>
          </tr>
        </thead>
        <tbody>
          {extracto.pagamentos.map((p) => (
            <tr key={p.id} className="border-t">
              <td>{formatarData(p.dataPagamento)}</td>
              <td>{formatarKz(p.valor)}</td>
              <td>{p.estado}</td>
              <td>
                {p.recibo ? (
                  <a className="underline" href={`/recibos/${p.id}`} data-testid="recibo">
                    {formatarNumeroRecibo(p.recibo)}
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {extracto.pagamentos.length === 0 && (
            <tr>
              <td colSpan={4} className="text-slate-600">
                Sem pagamentos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
