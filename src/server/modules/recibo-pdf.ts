import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatarData } from "@/lib/datas";
import { formatarKz } from "@/lib/dinheiro";
import { formatarNumeroRecibo } from "@/lib/financeiro";

export interface DadosRecibo {
  serie: string;
  ano: number;
  numero: number;
  emitidoEm: Date;
  estudante: { nome: string; numeroProcesso: string };
  valor: bigint;
  metodo: string;
  dataPagamento: Date;
  nomePagador: string | null;
  referenciaExterna: string | null;
  alocacoes: { descricao: string; valor: bigint }[];
}

const METODOS: Record<string, string> = {
  TRANSFERENCIA: "Transferência bancária",
  DEPOSITO: "Depósito",
  TPA: "Cartão (TPA)",
  NUMERARIO: "Numerário",
};

/** Gera o PDF do recibo (A5). Só texto: sem dados além dos necessários (nome e n.º de processo do estudante). */
export async function gerarReciboPdf(d: DadosRecibo): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Recibo ${formatarNumeroRecibo(d)}`);
  pdf.setProducer("Lá Manu");
  const page = pdf.addPage([420, 595]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 550;
  const linha = (texto: string, opts: { bold?: boolean; size?: number; gap?: number } = {}) => {
    page.drawText(texto, {
      x: 36,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? negrito : normal,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: 350,
    });
    y -= opts.gap ?? 18;
  };
  linha("Lá Manu — Recibo", { bold: true, size: 18, gap: 28 });
  linha(`N.º ${formatarNumeroRecibo(d)}`, { bold: true, size: 13, gap: 22 });
  linha(`Emitido em ${formatarData(d.emitidoEm)}`);
  y -= 8;
  linha(`Estudante: ${d.estudante.nome}`);
  linha(`Processo n.º ${d.estudante.numeroProcesso}`);
  if (d.nomePagador) linha(`Pago por: ${d.nomePagador}`);
  linha(`Data do pagamento: ${formatarData(d.dataPagamento)}`);
  linha(`Método: ${METODOS[d.metodo] ?? d.metodo}`);
  if (d.referenciaExterna) linha(`Referência: ${d.referenciaExterna}`);
  y -= 10;
  linha("Valor recebido", { bold: true });
  linha(formatarKz(d.valor), { bold: true, size: 16, gap: 26 });
  if (d.alocacoes.length > 0) {
    linha("Aplicado a:", { bold: true });
    for (const a of d.alocacoes)
      linha(`• ${a.descricao} — ${formatarKz(a.valor)}`, { size: 10, gap: 15 });
  }
  y -= 20;
  linha("Documento emitido electronicamente.", { size: 9 });
  return pdf.save();
}
