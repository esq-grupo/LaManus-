import ExcelJS from "exceljs";

// Ficheiro de EXEMPLO com dados exclusivamente FICTÍCIOS, com erros típicos de propósito. Serve para ensaios e testes.
// Nunca contém dados reais (regra do projecto).
export async function construirExemplo(opc: {
  ano: string;
  classe: string;
  turma: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const folha = (nome: string, cab: string[], linhas: (string | number | Date | null)[][]) => {
    const ws = wb.addWorksheet(nome);
    ws.addRow(cab);
    for (const l of linhas) ws.addRow(l);
  };
  folha(
    "Estudantes",
    ["N.º Processo", "Nome", "Data de Nascimento", "BI", "Contacto"],
    [
      [
        "IMP-001",
        "Aluno Fictício Um",
        new Date("2013-04-12T00:00:00Z"),
        "IMP000000001",
        "900000001",
      ],
      ["IMP-002", "Aluna Fictícia Dois", "15/08/2012", "IMP000000002", null], // data DD/MM/AAAA → transformada
      ["IMP-003", "Aluno Fictício Três", "2011-02-30", null, null], // data impossível → rejeitada
      ["IMP-004", "Aluno Fictício Quatro", "2013-01-01", "IMP000000001", null], // BI repetido no ficheiro → ambos rejeitados
      ["IMP-001", "Aluno Duplicado", "2013-04-12", null, null], // n.º de processo repetido → ambos rejeitados
      ["IMP-005", "Aluna Fictícia Cinco", "2013-09-09", null, null],
      ["IMP-006", "Al", "2013-09-09", null, null], // nome curto → rejeitada
    ],
  );
  folha(
    "Encarregados",
    ["BI", "Nome", "Contacto"],
    [
      ["ENCIMP0001", "Encarregado Fictício A", "910000001"],
      ["ENCIMP0002", "Encarregada Fictícia B", null],
      [null, "Sem BI", null], // chave em falta → rejeitada
    ],
  );
  folha(
    "Ligações",
    ["N.º Processo", "BI Encarregado", "Parentesco", "Principal"],
    [
      ["IMP-002", "ENCIMP0001", "Mãe", "sim"],
      ["IMP-005", "ENCIMP0002", "Padrinho", null], // parentesco inválido → rejeitada
      ["IMP-999", "ENCIMP0001", "Pai", null], // estudante inexistente → rejeitada
    ],
  );
  folha(
    "Matrículas",
    ["N.º Processo", "Ano Lectivo", "Classe", "Turma", "Tipo"],
    [
      ["IMP-002", opc.ano, opc.classe, opc.turma, "Nova"],
      ["IMP-005", opc.ano, opc.classe, opc.turma, "Nova"],
      ["IMP-005", opc.ano, opc.classe, opc.turma, "Renovação"], // já tem matrícula activa no ano → rejeitada
      ["IMP-002", opc.ano, opc.classe, "Z", "Renovação"], // turma inexistente → rejeitada
    ],
  );
  folha(
    "Saldos",
    ["N.º Processo", "Ano Lectivo", "Valor Kz", "Vencimento", "Descrição"],
    [
      ["IMP-002", opc.ano, "50.000,00", "2026-10-05", "Propina em atraso"], // valor transformado
      ["IMP-005", opc.ano, "abc", "2026-10-05", null], // valor inválido → rejeitada
      ["IMP-005", opc.ano, -5, "2026-10-05", null], // negativo → rejeitada
    ],
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}
