import { registarAuditoria } from "@/server/audit";
import { ipDoPedido, obterUtilizador } from "@/server/auth/dal";
import { ErroAutorizacao } from "@/server/erros";
import { obterRecibo } from "@/server/modules/financeiro";
import { gerarReciboPdf } from "@/server/modules/recibo-pdf";
import { formatarNumeroRecibo } from "@/lib/financeiro";

// Fora do `proxy`: a decisão é aqui, em cada descarga (sessão válida + permissão + escopo do estudante).
export async function GET(_: Request, { params }: { params: Promise<{ pagamentoId: string }> }) {
  const user = await obterUtilizador();
  if (!user) return new Response("Sessão inválida.", { status: 401 });
  const { pagamentoId } = await params;
  try {
    const { recibo, alocacoes } = await obterRecibo(user, pagamentoId);
    const pdf = await gerarReciboPdf({
      serie: recibo.serie,
      ano: recibo.ano,
      numero: recibo.numero,
      emitidoEm: recibo.emitidoEm,
      estudante: recibo.estudante,
      valor: recibo.valor,
      metodo: recibo.pagamento.metodo,
      dataPagamento: recibo.pagamento.dataPagamento,
      nomePagador: recibo.pagamento.nomePagador,
      referenciaExterna: recibo.pagamento.referenciaExterna,
      alocacoes: alocacoes.map((a) => ({ descricao: a.encargo.descricao, valor: a.valor })),
    });
    await registarAuditoria({
      actorId: user.id,
      acao: "RECIBO_DESCARREGADO",
      entidade: "Recibo",
      entidadeId: recibo.id,
      ip: await ipDoPedido(),
    });
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recibo-${formatarNumeroRecibo(recibo).replaceAll("/", "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErroAutorizacao)
      return new Response("Recibo não encontrado.", { status: 404 });
    throw e;
  }
}
