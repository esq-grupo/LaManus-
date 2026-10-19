import { describe, expect, it } from "vitest";
import { lerData, lerKz, normalizarTexto, validarFicheiro } from "@/lib/migracao/validar";
import type { Contexto } from "@/lib/migracao/tipos";
import { lerFicheiro, ErroFicheiro } from "@/server/migracao/ler";
import { construirExemplo } from "@/server/migracao/exemplo";
import { relatorioCsv } from "@/server/migracao/relatorio";
import ExcelJS from "exceljs";

const ctxVazio = (extra: Partial<Contexto> = {}): Contexto => ({
  hoje: new Date("2026-10-20T00:00:00.000Z"),
  estudantes: new Map(),
  biDeEstudantes: new Map(),
  encarregados: new Map(),
  ligacoes: new Set(),
  matriculas: [],
  turmas: new Map([["20262027|7classe|a", { turmaId: "t1", anoLectivoId: "a1" }]]),
  anos: new Map([["20262027", "a1"]]),
  saldosExistentes: new Set(),
  ...extra,
});

describe("leitura de datas e valores", () => {
  it("datas: ISO, DD/MM/AAAA (transformada), célula de data; inválidas rejeitadas", () => {
    expect(lerData("2012-08-15")).toEqual({ iso: "2012-08-15", transformada: false });
    expect(lerData("15/08/2012")).toEqual({ iso: "2012-08-15", transformada: true });
    expect(lerData(new Date("2012-08-15T00:00:00Z"))).toEqual({
      iso: "2012-08-15",
      transformada: false,
    });
    for (const mau of ["2011-02-30", "31/02/2012", "ontem", "", null, "2012-8-1"])
      expect(lerData(mau), String(mau)).toBeNull();
  });
  it("Kz: inteiros e separadores aceites; decimais, negativos e texto rejeitados", () => {
    expect(lerKz(50000)?.centimos).toBe(5_000_000n);
    expect(lerKz("50 000")).toEqual({ centimos: 5_000_000n, transformado: true });
    expect(lerKz("50.000,00")).toEqual({ centimos: 5_000_000n, transformado: true });
    expect(lerKz("50000")).toEqual({ centimos: 5_000_000n, transformado: false });
    for (const mau of [-5, 0, 12.5, "abc", "50,5", "5 0", "1e6", null, 2_000_000_000])
      expect(lerKz(mau as never), String(mau)).toBeNull();
  });
  it("normaliza nomes de colunas e de classes", () => {
    expect(normalizarTexto("N.º Processo")).toBe("nprocesso"); // sinónimo aceite no cabeçalho
    expect(normalizarTexto("Matrículas")).toBe("matriculas");
    expect(normalizarTexto("7.ª classe")).toBe("7classe");
  });
});

describe("ficheiro de exemplo FICTÍCIO: o que entra e o que é rejeitado (com motivo)", () => {
  it("lê o Excel, valida e separa válidas de rejeitadas", async () => {
    const buf = await construirExemplo({ ano: "2026/2027", classe: "7.ª classe", turma: "A" });
    const plano = validarFicheiro(await lerFicheiro(buf), ctxVazio());
    expect(plano.estudantes.map((e) => e.numeroProcesso).sort()).toEqual(["IMP-002", "IMP-005"]);
    expect(plano.encarregados.map((e) => e.bi).sort()).toEqual(["ENCIMP0001", "ENCIMP0002"]);
    expect(plano.ligacoes).toHaveLength(1);
    expect(plano.matriculas.map((m) => m.numeroProcesso).sort()).toEqual(["IMP-002", "IMP-005"]);
    expect(plano.saldos.map((x) => [x.numeroProcesso, x.valorCentimos])).toEqual([
      ["IMP-002", 5_000_000n],
    ]); // «50.000,00» → 50 000 Kz
    const rej = plano.problemas.filter((p) => p.tipo === "REJEITADA");
    const motivos = rej.map((p) => `${p.folha}:${p.linha}:${p.coluna}`);
    for (const esperado of [
      "Estudantes:4:datanascimento", // IMP-003 data impossível
      "Estudantes:5:bi", // BI repetido (IMP-001/IMP-004)
      "Estudantes:6:numeroprocesso", // IMP-001 repetido
      "Estudantes:8:nome", // nome curto
      "Encarregados:4:bi", // sem chave
      "Ligacoes:3:parentesco",
      "Ligacoes:4:numeroprocesso", // estudante inexistente
      "Matriculas:4:turma", // já activa no ano
      "Matriculas:5:turma", // turma inexistente
      "Saldos:3:numeroprocesso", // IMP-005 tem dois saldos: ambíguo, não se somam
      "Saldos:4:numeroprocesso",
    ])
      expect(motivos, esperado).toContain(esperado);
    expect(
      plano.problemas.some((p) => p.tipo === "TRANSFORMADA" && p.coluna === "datanascimento"),
    ).toBe(true);
  });

  it("dados pessoais nunca aparecem completos no relatório (nomes e BI mascarados) e o CSV não executa fórmulas", async () => {
    const buf = await construirExemplo({ ano: "2026/2027", classe: "7.ª classe", turma: "A" });
    const plano = validarFicheiro(await lerFicheiro(buf), ctxVazio());
    const csv = relatorioCsv(plano.problemas);
    expect(csv).not.toContain("Aluno Duplicado");
    expect(csv).not.toContain("IMP000000001");
    // nem o n.º de processo nem a data de nascimento completos (revisão do Codex à H2)
    for (const pessoal of [
      "IMP-001",
      "IMP-002",
      "IMP-003",
      "IMP-005",
      "2011-02-30",
      "2012-08-15",
      "15/08/2012",
    ])
      expect(csv, pessoal).not.toContain(pessoal);
    expect(csv).toContain("2011-**-**");
    expect(
      relatorioCsv([
        {
          folha: "Estudantes",
          linha: 2,
          coluna: "x",
          valor: '=HYPERLINK("http://x")',
          motivo: "m",
          tipo: "REJEITADA",
        },
      ]),
    ).toContain("\"'=HYPERLINK");
  });

  it("idempotência: o que já existe é «já existe» e não se importa outra vez; conflitos vão para revisão", async () => {
    const buf = await construirExemplo({ ano: "2026/2027", classe: "7.ª classe", turma: "A" });
    const ctx = ctxVazio({
      estudantes: new Map([
        [
          "IMP-002",
          { nome: "Aluna Fictícia Dois", dataNascimento: "2012-08-15", bi: "IMP000000002" },
        ],
        ["IMP-005", { nome: "OUTRO NOME", dataNascimento: "2013-09-09", bi: null }],
      ]),
      biDeEstudantes: new Map([["IMP000000002", "IMP-002"]]),
    });
    const plano = validarFicheiro(await lerFicheiro(buf), ctx);
    expect(plano.estudantes).toHaveLength(0);
    expect(plano.problemas.some((p) => p.tipo === "JA_EXISTE" && p.folha === "Estudantes")).toBe(
      true,
    );
    expect(
      plano.problemas.some((p) => p.tipo === "REJEITADA" && p.motivo.includes("diferentes")),
    ).toBe(true); // IMP-005 com outro nome
  });

  it("ligações entram sempre por verificar; BI de estudante noutra conta é conflito", async () => {
    const buf = await construirExemplo({ ano: "2026/2027", classe: "7.ª classe", turma: "A" });
    const plano = validarFicheiro(
      await lerFicheiro(buf),
      ctxVazio({ biDeEstudantes: new Map([["IMP000000002", "OUTRO-PROC"]]) }),
    );
    expect(plano.estudantes.map((e) => e.numeroProcesso)).not.toContain("IMP-002");
  });
});

describe("regras de matrícula (Entrega C) respeitadas pelo importador", () => {
  it("segunda matrícula «Nova» do mesmo estudante é rejeitada; «Renovação» noutro ano é aceite; duas activas no mesmo ano não", async () => {
    const buf = await construirExemplo({ ano: "2026/2027", classe: "7.ª classe", turma: "A" });
    const ctx = ctxVazio({
      estudantes: new Map([
        [
          "IMP-002",
          { nome: "Aluna Fictícia Dois", dataNascimento: "2012-08-15", bi: "IMP000000002" },
        ],
      ]),
      matriculas: [
        {
          numeroProcesso: "IMP-002",
          anoLectivoId: "ano-antigo",
          tipo: "NOVA",
          estado: "CONCLUIDA",
        },
      ],
    });
    const plano = validarFicheiro(await lerFicheiro(buf), ctx);
    expect(plano.matriculas.map((m) => m.numeroProcesso)).not.toContain("IMP-002"); // já teve «Nova»
    expect(
      plano.problemas.some((p) => p.folha === "Matriculas" && p.motivo.includes("«Nova»")),
    ).toBe(true);
    // com uma matrícula activa no mesmo ano, também é recusada
    const ctx2 = ctxVazio({
      estudantes: new Map([
        [
          "IMP-002",
          { nome: "Aluna Fictícia Dois", dataNascimento: "2012-08-15", bi: "IMP000000002" },
        ],
      ]),
      matriculas: [
        { numeroProcesso: "IMP-002", anoLectivoId: "a1", tipo: "RENOVACAO", estado: "ACTIVA" },
      ],
    });
    const plano2 = validarFicheiro(await lerFicheiro(buf), ctx2);
    expect(plano2.matriculas.map((m) => m.numeroProcesso)).not.toContain("IMP-002");
    expect(plano2.problemas.some((p) => p.motivo.includes("matrícula activa neste ano"))).toBe(
      true,
    );
  });
});

describe("ficheiro inválido", () => {
  it("não é Excel / coluna obrigatória em falta / demasiado grande → erro claro", async () => {
    await expect(lerFicheiro(Buffer.from("isto não é um xlsx"))).rejects.toBeInstanceOf(
      ErroFicheiro,
    );
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Estudantes");
    ws.addRow(["nome"]);
    await expect(lerFicheiro(Buffer.from(await wb.xlsx.writeBuffer()))).rejects.toThrow(
      /faltam as colunas obrigatórias/,
    );
    await expect(lerFicheiro(Buffer.alloc(11 * 1024 * 1024))).rejects.toThrow(/demasiado grande/);
  });
});
