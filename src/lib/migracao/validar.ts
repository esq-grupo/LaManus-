import { mascararBi } from "@/lib/mascarar";
import { PARENTESCOS } from "@/lib/parentescos";
import { kzParaCentimos } from "@/lib/dinheiro";
import type {
  Celula,
  Contexto,
  DadosFicheiro,
  Folha,
  Linha,
  Plano,
  Problema,
  TipoProblema,
} from "./tipos";

// Validação PURA do ficheiro de importação (modo «ensaio»: nada é gravado). Cada linha é aceite ou rejeitada com motivo
// (folha, linha, coluna, valor MASCARADO). Duplicados e ambiguidades NUNCA se fundem sozinhos: vão para revisão manual.

export const normalizarTexto = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const texto = (c: Celula | undefined): string => {
  if (c == null) return "";
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c).replace(/\s+/g, " ").trim();
};

/** Mostra o valor num relatório sem expor dados pessoais completos (nomes encurtados, BI mascarado). */
function mostrar(coluna: string, c: Celula | undefined): string {
  const t = texto(c);
  if (coluna === "bi" || coluna === "biencarregado") return mascararBi(t) ?? "";
  if (coluna === "nome" || coluna === "contacto") return t.length <= 2 ? "**" : `${t.slice(0, 2)}…`;
  return t.slice(0, 40);
}

const hojeISO = (d: Date) => d.toISOString().slice(0, 10);

/** Datas aceites: célula de data, AAAA-MM-DD ou DD/MM/AAAA (esta última conta como «transformada»). */
export function lerData(c: Celula | undefined): { iso: string; transformada: boolean } | null {
  if (c instanceof Date)
    return Number.isNaN(c.getTime()) ? null : { iso: hojeISO(c), transformada: false };
  const t = texto(c);
  const iso8601 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const dmy = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(t);
  let iso: string;
  if (iso8601) iso = t;
  else if (dmy) iso = `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  else return null;
  const dt = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso) return null;
  return { iso, transformada: !iso8601 };
}

/** Kz inteiros: 50000, "50 000", "50.000", "50.000,00". Decimais não nulos, negativos e texto são rejeitados. */
export function lerKz(c: Celula | undefined): { centimos: bigint; transformado: boolean } | null {
  if (typeof c === "number") {
    if (!Number.isInteger(c) || c <= 0 || c > 1_000_000_000) return null;
    return { centimos: kzParaCentimos(c), transformado: false };
  }
  const t = texto(c);
  if (/^\d{1,10}$/.test(t)) return pos(t, false);
  if (/^\d{1,3}([ .]\d{3})+(,00)?$/.test(t))
    return pos(t.replace(/,00$/, "").replace(/[ .]/g, ""), true);
  if (/^\d+,00$/.test(t)) return pos(t.slice(0, -3), true);
  return null;
}
function pos(digitos: string, transformado: boolean) {
  const n = BigInt(digitos);
  if (n <= 0n || n > 1_000_000_000n) return null;
  return { centimos: n * 100n, transformado };
}

export function validarFicheiro(dados: DadosFicheiro, ctx: Contexto): Plano {
  const plano: Plano = {
    estudantes: [],
    encarregados: [],
    ligacoes: [],
    matriculas: [],
    saldos: [],
    problemas: [],
  };
  const problema = (
    folha: Folha,
    linha: number,
    coluna: string,
    valor: Celula | undefined,
    motivo: string,
    tipo: TipoProblema = "REJEITADA",
  ) =>
    plano.problemas.push({
      folha,
      linha,
      coluna,
      valor: mostrar(coluna, valor),
      motivo,
      tipo,
    } satisfies Problema);
  const rejeitar = (folha: Folha, l: Linha, coluna: string, motivo: string) => {
    problema(folha, l.linha, coluna, l.valores[coluna], motivo);
  };

  // ── Estudantes ─────────────────────────────────────────────────────────────
  const nProcessoNoFicheiro = new Map<string, number[]>();
  const biNoFicheiro = new Map<string, number[]>();
  for (const l of dados.Estudantes) {
    const np = texto(l.valores.numeroprocesso);
    const bi = texto(l.valores.bi).replace(/\s+/g, "").toUpperCase();
    if (np) nProcessoNoFicheiro.set(np, [...(nProcessoNoFicheiro.get(np) ?? []), l.linha]);
    if (bi) biNoFicheiro.set(bi, [...(biNoFicheiro.get(bi) ?? []), l.linha]);
  }
  const estudantesValidos = new Set<string>();
  for (const l of dados.Estudantes) {
    const np = texto(l.valores.numeroprocesso);
    const nome = texto(l.valores.nome);
    const bi = texto(l.valores.bi).replace(/\s+/g, "").toUpperCase();
    const contacto = texto(l.valores.contacto);
    if (!np || np.length > 30 || !/^[A-Za-z0-9._/-]+$/.test(np)) {
      rejeitar(
        "Estudantes",
        l,
        "numeroprocesso",
        "N.º de processo em falta ou com caracteres inválidos.",
      );
      continue;
    }
    if ((nProcessoNoFicheiro.get(np) ?? []).length > 1) {
      rejeitar(
        "Estudantes",
        l,
        "numeroprocesso",
        "N.º de processo repetido no ficheiro: reveja manualmente (não se funde).",
      );
      continue;
    }
    if (nome.length < 3 || nome.length > 160) {
      rejeitar("Estudantes", l, "nome", "Nome em falta ou com tamanho inválido.");
      continue;
    }
    const data = lerData(l.valores.datanascimento);
    if (!data) {
      rejeitar(
        "Estudantes",
        l,
        "datanascimento",
        "Data de nascimento inválida (use AAAA-MM-DD ou DD/MM/AAAA).",
      );
      continue;
    }
    const ano = Number(data.iso.slice(0, 4));
    const anoHoje = ctx.hoje.getUTCFullYear();
    if (data.iso > hojeISO(ctx.hoje) || ano < anoHoje - 40 || ano > anoHoje - 2) {
      rejeitar(
        "Estudantes",
        l,
        "datanascimento",
        "Data de nascimento fora do intervalo plausível para um estudante.",
      );
      continue;
    }
    if (bi && (bi.length < 5 || bi.length > 30)) {
      rejeitar("Estudantes", l, "bi", "BI/cédula inválido.");
      continue;
    }
    if (bi && (biNoFicheiro.get(bi) ?? []).length > 1) {
      rejeitar("Estudantes", l, "bi", "BI repetido no ficheiro: reveja manualmente.");
      continue;
    }
    if (bi) {
      const dono = ctx.biDeEstudantes.get(bi);
      if (dono && dono !== np) {
        rejeitar("Estudantes", l, "bi", "Este BI já pertence a outro estudante na base de dados.");
        continue;
      }
    }
    const existente = ctx.estudantes.get(np);
    if (existente) {
      if (
        existente.nome.toLowerCase() === nome.toLowerCase() &&
        existente.dataNascimento === data.iso
      ) {
        problema(
          "Estudantes",
          l.linha,
          "numeroprocesso",
          np,
          "Já existe com os mesmos dados: ignorado (repetir não duplica).",
          "JA_EXISTE",
        );
        estudantesValidos.add(np);
      } else {
        rejeitar(
          "Estudantes",
          l,
          "numeroprocesso",
          "N.º de processo já existe com nome/data de nascimento diferentes: reveja manualmente.",
        );
      }
      continue;
    }
    if (data.transformada)
      problema(
        "Estudantes",
        l.linha,
        "datanascimento",
        l.valores.datanascimento,
        `Data convertida para ${data.iso}.`,
        "TRANSFORMADA",
      );
    plano.estudantes.push({
      linha: l.linha,
      numeroProcesso: np,
      nome,
      dataNascimento: data.iso,
      bi: bi || null,
      contacto: contacto || null,
    });
    estudantesValidos.add(np);
  }

  // ── Encarregados (chave: BI) ───────────────────────────────────────────────
  const biEnc = new Map<string, number[]>();
  for (const l of dados.Encarregados) {
    const bi = texto(l.valores.bi).replace(/\s+/g, "").toUpperCase();
    if (bi) biEnc.set(bi, [...(biEnc.get(bi) ?? []), l.linha]);
  }
  const encarregadosValidos = new Set<string>();
  for (const l of dados.Encarregados) {
    const bi = texto(l.valores.bi).replace(/\s+/g, "").toUpperCase();
    const nome = texto(l.valores.nome);
    const contacto = texto(l.valores.contacto);
    if (bi.length < 5 || bi.length > 30) {
      rejeitar(
        "Encarregados",
        l,
        "bi",
        "BI/cédula em falta ou inválido (é a chave do encarregado).",
      );
      continue;
    }
    if ((biEnc.get(bi) ?? []).length > 1) {
      rejeitar("Encarregados", l, "bi", "BI repetido no ficheiro: reveja manualmente.");
      continue;
    }
    if (nome.length < 3 || nome.length > 160) {
      rejeitar("Encarregados", l, "nome", "Nome em falta ou com tamanho inválido.");
      continue;
    }
    const ex = ctx.encarregados.get(bi);
    if (ex) {
      if (ex.nome.toLowerCase() === nome.toLowerCase()) {
        problema(
          "Encarregados",
          l.linha,
          "bi",
          bi,
          "Já existe com os mesmos dados: ignorado.",
          "JA_EXISTE",
        );
        encarregadosValidos.add(bi);
      } else rejeitar("Encarregados", l, "bi", "BI já existe com outro nome: reveja manualmente.");
      continue;
    }
    plano.encarregados.push({ linha: l.linha, bi, nome, contacto: contacto || null });
    encarregadosValidos.add(bi);
  }
  const estudanteExiste = (np: string) => estudantesValidos.has(np) || ctx.estudantes.has(np);
  const encarregadoExiste = (bi: string) => encarregadosValidos.has(bi) || ctx.encarregados.has(bi);

  // ── Ligações (entram SEMPRE por verificar: o acesso aos portais é decidido pela Secretaria) ──
  const vistas = new Set<string>();
  for (const l of dados.Ligacoes) {
    const np = texto(l.valores.numeroprocesso);
    const bi = texto(l.valores.biencarregado).replace(/\s+/g, "").toUpperCase();
    const parentesco = texto(l.valores.parentesco);
    if (!estudanteExiste(np)) {
      rejeitar("Ligacoes", l, "numeroprocesso", "Estudante inexistente ou rejeitado.");
      continue;
    }
    if (!encarregadoExiste(bi)) {
      rejeitar("Ligacoes", l, "biencarregado", "Encarregado inexistente ou rejeitado.");
      continue;
    }
    const p = PARENTESCOS.find((x) => normalizarTexto(x) === normalizarTexto(parentesco));
    if (!p) {
      rejeitar(
        "Ligacoes",
        l,
        "parentesco",
        `Parentesco inválido (use: ${PARENTESCOS.join(", ")}).`,
      );
      continue;
    }
    const chave = `${np}|${bi}`;
    if (ctx.ligacoes.has(chave) || vistas.has(chave)) {
      problema(
        "Ligacoes",
        l.linha,
        "numeroprocesso",
        np,
        "Ligação já existe: ignorada.",
        "JA_EXISTE",
      );
      continue;
    }
    vistas.add(chave);
    const principal = /^(1|sim|s|true|verdadeiro|x)$/i.test(texto(l.valores.principal));
    plano.ligacoes.push({ linha: l.linha, numeroProcesso: np, bi, parentesco: p, principal });
  }

  // ── Matrículas (regras da Entrega C: uma «Nova» por estudante; uma activa por estudante e ano) ──
  const novaPorEstudante = new Set(
    ctx.matriculas
      .filter((m) => m.tipo === "NOVA" && m.estado !== "ANULADA")
      .map((m) => m.numeroProcesso),
  );
  const activaPorAno = new Set(
    ctx.matriculas
      .filter((m) => m.estado === "ACTIVA")
      .map((m) => `${m.numeroProcesso}|${m.anoLectivoId}`),
  );
  for (const l of dados.Matriculas) {
    const np = texto(l.valores.numeroprocesso);
    if (!estudanteExiste(np)) {
      rejeitar("Matriculas", l, "numeroprocesso", "Estudante inexistente ou rejeitado.");
      continue;
    }
    const tipoTxt = normalizarTexto(texto(l.valores.tipo));
    const tipo = tipoTxt === "nova" ? "NOVA" : tipoTxt === "renovacao" ? "RENOVACAO" : null;
    if (!tipo) {
      rejeitar("Matriculas", l, "tipo", "Tipo inválido (use Nova ou Renovação).");
      continue;
    }
    const chaveTurma = [l.valores.anolectivo, l.valores.classe, l.valores.turma]
      .map((x) => normalizarTexto(texto(x)))
      .join("|");
    const turma = ctx.turmas.get(chaveTurma);
    if (!turma) {
      rejeitar(
        "Matriculas",
        l,
        "turma",
        "Ano lectivo/classe/turma inexistente (crie primeiro a estrutura escolar).",
      );
      continue;
    }
    if (tipo === "NOVA" && novaPorEstudante.has(np)) {
      rejeitar(
        "Matriculas",
        l,
        "tipo",
        "O estudante já tem uma matrícula «Nova»; as seguintes são «Renovação».",
      );
      continue;
    }
    const chaveAno = `${np}|${turma.anoLectivoId}`;
    if (activaPorAno.has(chaveAno)) {
      rejeitar("Matriculas", l, "turma", "O estudante já tem matrícula activa neste ano lectivo.");
      continue;
    }
    if (tipo === "NOVA") novaPorEstudante.add(np);
    activaPorAno.add(chaveAno);
    plano.matriculas.push({
      linha: l.linha,
      numeroProcesso: np,
      turmaId: turma.turmaId,
      anoLectivoId: turma.anoLectivoId,
      tipo,
    });
  }

  // ── Saldos transitados → encargos de abertura (nunca pagamentos inventados) ──
  const saldosPorEstudante = new Map<string, number>();
  for (const l of dados.Saldos) {
    const k = `${texto(l.valores.numeroprocesso)}|${normalizarTexto(texto(l.valores.anolectivo))}`;
    saldosPorEstudante.set(k, (saldosPorEstudante.get(k) ?? 0) + 1);
  }
  for (const l of dados.Saldos) {
    const np = texto(l.valores.numeroprocesso);
    if (!estudanteExiste(np)) {
      rejeitar("Saldos", l, "numeroprocesso", "Estudante inexistente ou rejeitado.");
      continue;
    }
    const anoId = ctx.anos.get(normalizarTexto(texto(l.valores.anolectivo)));
    if (!anoId) {
      rejeitar("Saldos", l, "anolectivo", "Ano lectivo inexistente.");
      continue;
    }
    if (
      (saldosPorEstudante.get(`${np}|${normalizarTexto(texto(l.valores.anolectivo))}`) ?? 0) > 1
    ) {
      rejeitar(
        "Saldos",
        l,
        "numeroprocesso",
        "Mais de um saldo para o mesmo estudante e ano: reveja manualmente (não se somam).",
      );
      continue;
    }
    const kz = lerKz(l.valores.valorkz);
    if (!kz) {
      rejeitar(
        "Saldos",
        l,
        "valorkz",
        "Valor inválido (Kz inteiros, positivos; ex.: 50000 ou 50 000).",
      );
      continue;
    }
    const venc = lerData(l.valores.vencimento);
    if (!venc) {
      rejeitar("Saldos", l, "vencimento", "Data de vencimento inválida.");
      continue;
    }
    if (ctx.saldosExistentes.has(`${np}|${anoId}`)) {
      problema(
        "Saldos",
        l.linha,
        "numeroprocesso",
        np,
        "Saldo de abertura já importado: ignorado.",
        "JA_EXISTE",
      );
      continue;
    }
    if (kz.transformado)
      problema(
        "Saldos",
        l.linha,
        "valorkz",
        l.valores.valorkz,
        "Valor convertido para Kz inteiros.",
        "TRANSFORMADA",
      );
    const descricao = texto(l.valores.descricao) || "Saldo transitado";
    plano.saldos.push({
      linha: l.linha,
      numeroProcesso: np,
      anoLectivoId: anoId,
      valorCentimos: kz.centimos,
      vencimento: venc.iso,
      descricao: descricao.slice(0, 200),
    });
  }
  return plano;
}
