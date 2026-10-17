import { describe, expect, it } from "vitest";
import { gerarReciboPdf } from "@/server/modules/recibo-pdf";

describe("recibo PDF", () => {
  it("gera um PDF válido com os dados do recibo", async () => {
    const bytes = await gerarReciboPdf({
      serie: "R",
      ano: 2026,
      numero: 7,
      emitidoEm: new Date("2026-10-17T10:00:00Z"),
      estudante: { nome: "Estudante Fictício 1", numeroProcesso: "TESTE-0001" },
      valor: 60_000_00n,
      metodo: "TRANSFERENCIA",
      dataPagamento: new Date("2026-10-17T00:00:00Z"),
      nomePagador: null,
      referenciaExterna: "TRF-1",
      alocacoes: [{ descricao: "Propina — 2026-10", valor: 50_000_00n }],
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(800);
  });
});
