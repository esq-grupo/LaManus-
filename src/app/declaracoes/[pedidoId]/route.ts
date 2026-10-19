import { ipDoPedido, obterUtilizador } from "@/server/auth/dal";
import { ErroAutorizacao } from "@/server/erros";
import { obterDocumento } from "@/server/modules/declaracoes";
import { gerarDeclaracaoPdf } from "@/server/modules/declaracao-pdf";
import { formatarNumeroDocumento } from "@/lib/declaracoes";

// Fora do `proxy`: a decisão é aqui, em cada descarga (sessão + permissão + escopo). «Não existe» e «sem acesso» → 404 igual.
export async function GET(_: Request, { params }: { params: Promise<{ pedidoId: string }> }) {
  const user = await obterUtilizador();
  if (!user) return new Response("Sessão inválida.", { status: 401 });
  const { pedidoId } = await params;
  try {
    const { documento, dados } = await obterDocumento(user, pedidoId, await ipDoPedido());
    const pdf = await gerarDeclaracaoPdf({ ...documento, dados });
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="declaracao-${formatarNumeroDocumento(documento).replaceAll("/", "-")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof ErroAutorizacao)
      return new Response("Documento não encontrado.", { status: 404 });
    throw e;
  }
}
