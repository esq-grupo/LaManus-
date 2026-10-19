import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatarData } from "@/lib/datas";
import {
  formatarNumeroDocumento,
  TEXTOS_DECLARACAO,
  type DadosDeclaracao,
} from "@/lib/declaracoes";

/** Gera o PDF a partir do instantâneo gravado (nunca de dados vivos): o mesmo documento hoje e daqui a um ano. */
export async function gerarDeclaracaoPdf(d: {
  serie: string;
  ano: number;
  numero: number;
  codigo: string;
  emitidaEm: Date;
  dados: DadosDeclaracao;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const numero = formatarNumeroDocumento(d);
  pdf.setTitle(`Declaração ${numero}`);
  pdf.setProducer("Lá Manu");
  const page = pdf.addPage([595, 842]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 780;
  const texto = (t: string, o: { bold?: boolean; size?: number; gap?: number } = {}) => {
    page.drawText(t, {
      x: 56,
      y,
      size: o.size ?? 12,
      font: o.bold ? negrito : normal,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth: 480,
      lineHeight: 17,
    });
    y -= o.gap ?? 22;
  };
  texto("Complexo Escolar Privado Lá Manu", { bold: true, size: 16, gap: 34 });
  texto(`DECLARAÇÃO N.º ${numero}`, { bold: true, size: 14, gap: 36 });
  const linhas = TEXTOS_DECLARACAO[d.dados.tipo](d.dados);
  for (const l of linhas) {
    texto(l, { gap: 46 });
  }
  y -= 20;
  texto(`Emitida em ${formatarData(d.emitidaEm)}.`);
  texto(`Código de verificação: ${d.codigo}`, { size: 10 });
  texto("Documento emitido electronicamente pela Secretaria.", { size: 9 });
  return pdf.save();
}
