import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { comAuditoria, registarAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { escopoFinanceiro, veFinanceiroCompleto } from "@/server/authz/scope";
import { ErroAutorizacao, ErroValidacao, ehViolacaoUnica } from "@/server/erros";
import { dataSchema, hojeEmLuanda } from "@/lib/datas";
import { kzParaCentimos } from "@/lib/dinheiro";
import { notificarReciboEmitido } from "./notificacoes";
import { estadoEncargo, mesesEntre, referenciaMensal } from "@/lib/financeiro";

// Entrega E — Financeiro base (ADR-0004). Todo o dinheiro em cêntimos (BigInt).
// Movimentos (registar, confirmar, alocar, estornar) passam por funções da BD que autenticam o autor pelo TOKEN DA SESSÃO.

export interface ContextoPedido {
  tokenSessao: string | null;
  ip?: string | null;
}

const uuid = z.string().uuid("Identificador inválido.");
const motivoSchema = z.string().trim().min(5, "Indique o motivo (mínimo 5 caracteres).").max(300);
/** Valor em Kz inteiros (texto ou número) → cêntimos. Rejeita vírgulas, espaços, negativos e, se pedido, zero. */
function kz(permitirZero: boolean) {
  return z.union([z.string(), z.number(), z.bigint()]).transform((v, ctx) => {
    const t = String(v).trim();
    if (!/^\d{1,10}$/.test(t)) {
      ctx.addIssue({
        code: "custom",
        message: "Indique o valor em Kz, em números inteiros (sem espaços nem vírgulas).",
      });
      return z.NEVER;
    }
    const n = BigInt(t);
    if (!permitirZero && n === 0n) {
      ctx.addIssue({ code: "custom", message: "O valor tem de ser superior a zero." });
      return z.NEVER;
    }
    return kzParaCentimos(n);
  });
}
const kzSchema = kz(false);
const kzOuZero = kz(true);

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

type PermissaoFin =
  | "financeiro:ver"
  | "financeiro:editar"
  | "pagamento:confirmar"
  | "estorno:propor"
  | "estorno:aprovar";

function exigir(actor: Principal, p: PermissaoFin) {
  if (!can(actor, p)) throw new ErroAutorizacao();
}
/** Leitura de gestão: Direcção, Secretaria ou Financeiro. */
function exigirGestao(actor: Principal) {
  if (!veFinanceiroCompleto(actor)) throw new ErroAutorizacao();
}

function exigirSessao(ctx: ContextoPedido): string {
  if (!ctx.tokenSessao) throw new ErroAutorizacao("Sessão inválida.");
  return ctx.tokenSessao;
}

/** A BD recusou: sessão/permissão → erro de autorização; regra de negócio → mensagem em português (sem detalhes técnicos). */
async function chamar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = String((e as { message?: string }).message ?? "");
    if (/Sessão inválida|Sem permissão \(/.test(msg))
      throw new ErroAutorizacao("Sessão inválida ou sem permissão para esta operação.");
    const regra = msg.match(
      /(Quem [^\n"]+|O estorno [^\n"]+|Só se [^\n"]+|A alocação [^\n"]+|O encargo [^\n"]+|O pagamento [^\n"]+|Motivo obrigatório[^\n"]*|Valor inválido|A data do pagamento[^\n"]*|Estudante inexistente|Pagamento inexistente|Estorno inexistente)/,
    );
    if (regra) throw new ErroValidacao([regra[1]!.replace(/\s+$/, "")]);
    throw e;
  }
}

// ── Tipos de encargo ─────────────────────────────────────────────────────────

export async function listarTipos(actor: Principal) {
  exigirGestao(actor);
  return db.tipoEncargo.findMany({ orderBy: [{ activo: "desc" }, { nome: "asc" }] });
}

const tipoSchema = z.object({
  nome: z.string().trim().min(2, "Indique o nome do tipo de encargo.").max(80),
  valorKz: kzOuZero,
  periodicidade: z.enum(["MENSAL", "ANUAL", "UNICO"]),
});

export async function criarTipo(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "financeiro:editar");
  const d = analisar(tipoSchema, entrada);
  try {
    return await comAuditoria(async (tx) => {
      const t = await tx.tipoEncargo.create({
        data: { nome: d.nome, valorReferencia: d.valorKz, periodicidade: d.periodicidade },
      });
      return {
        resultado: t,
        evento: {
          actorId: actor.id,
          acao: "TIPO_ENCARGO_CRIADO",
          entidade: "TipoEncargo",
          entidadeId: t.id,
          depois: { nome: d.nome, valor: d.valorKz, periodicidade: d.periodicidade },
          ip,
        },
      };
    });
  } catch (e) {
    if (ehViolacaoUnica(e))
      throw new ErroValidacao(["Já existe um tipo de encargo com esse nome."]);
    throw e;
  }
}

// ── Encargos ─────────────────────────────────────────────────────────────────

const geracaoSchema = z.object({
  tipoEncargoId: uuid,
  anoLectivoId: uuid,
  referencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido (use AAAA-MM)."),
  diaVencimento: z.coerce.number().int().min(1).max(28).default(5),
});

/**
 * Geração em lote das propinas mensais de UM mês para todos os estudantes com matrícula ACTIVA no ano lectivo.
 * Idempotente: repetir o pedido não duplica (chave única estudante+tipo+referência); só cria o que falta.
 * O valor é o do tipo de encargo no momento da geração e nunca mais se edita.
 */
export async function gerarEncargosMensais(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "financeiro:editar");
  const d = analisar(geracaoSchema, entrada);
  const [tipo, ano] = await Promise.all([
    db.tipoEncargo.findUnique({ where: { id: d.tipoEncargoId } }),
    db.anoLectivo.findUnique({ where: { id: d.anoLectivoId } }),
  ]);
  if (!tipo || !ano) throw new ErroValidacao(["Tipo de encargo ou ano lectivo inexistente."]);
  if (!tipo.activo) throw new ErroValidacao(["O tipo de encargo está desactivado."]);
  if (tipo.periodicidade !== "MENSAL")
    throw new ErroValidacao(["Só tipos de encargo mensais geram propinas mensais."]);
  if (tipo.valorReferencia <= 0n)
    throw new ErroValidacao(["O tipo de encargo não tem valor definido."]);
  if (!mesesEntre(ano.inicio, ano.fim).includes(d.referencia))
    throw new ErroValidacao(["O mês indicado está fora do ano lectivo."]);
  const vencimento = new Date(
    `${d.referencia}-${String(d.diaVencimento).padStart(2, "0")}T00:00:00.000Z`,
  );

  return comAuditoria(async (tx) => {
    const matriculas = await tx.matricula.findMany({
      where: { anoLectivoId: ano.id, estado: "ACTIVA" },
      select: { estudanteId: true },
      distinct: ["estudanteId"],
    });
    const r = await tx.encargo.createMany({
      data: matriculas.map((m) => ({
        estudanteId: m.estudanteId,
        tipoEncargoId: tipo.id,
        anoLectivoId: ano.id,
        referencia: d.referencia,
        descricao: `${tipo.nome} — ${d.referencia}`,
        valor: tipo.valorReferencia,
        vencimento,
        criadoPorId: actor.id,
      })),
      skipDuplicates: true,
    });
    return {
      resultado: {
        elegiveis: matriculas.length,
        criados: r.count,
        jaExistentes: matriculas.length - r.count,
      },
      evento: {
        actorId: actor.id,
        acao: "ENCARGOS_GERADOS",
        entidade: "TipoEncargo",
        entidadeId: tipo.id,
        depois: {
          referencia: d.referencia,
          anoLectivoId: ano.id,
          elegiveis: matriculas.length,
          criados: r.count,
        },
        ip,
      },
    };
  });
}

const encargoSchema = z.object({
  estudanteId: uuid,
  tipoEncargoId: uuid,
  anoLectivoId: uuid,
  referencia: z.string().trim().min(1, "Indique a referência.").max(40),
  descricao: z.string().trim().max(200).optional(),
  valorKz: kzSchema,
  vencimento: dataSchema,
});

/** Encargo avulso (matrícula, material, etc.). */
export async function criarEncargo(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "financeiro:editar");
  const d = analisar(encargoSchema, entrada);
  const tipo = await db.tipoEncargo.findUnique({ where: { id: d.tipoEncargoId } });
  if (!tipo || !tipo.activo)
    throw new ErroValidacao(["Tipo de encargo inexistente ou desactivado."]);
  try {
    return await comAuditoria(async (tx) => {
      const e = await tx.encargo.create({
        data: {
          estudanteId: d.estudanteId,
          tipoEncargoId: tipo.id,
          anoLectivoId: d.anoLectivoId,
          referencia: d.referencia,
          descricao: d.descricao || `${tipo.nome} — ${d.referencia}`,
          valor: d.valorKz,
          vencimento: d.vencimento,
          criadoPorId: actor.id,
        },
      });
      return {
        resultado: e,
        evento: {
          actorId: actor.id,
          acao: "ENCARGO_CRIADO",
          entidade: "Encargo",
          entidadeId: e.id,
          depois: { estudanteId: d.estudanteId, valor: d.valorKz, referencia: d.referencia },
          ip,
        },
      };
    });
  } catch (e) {
    if (ehViolacaoUnica(e))
      throw new ErroValidacao(["Esse estudante já tem um encargo deste tipo com essa referência."]);
    if ((e as { code?: string }).code === "P2003")
      throw new ErroValidacao(["Estudante ou ano lectivo inexistente."]);
    throw e;
  }
}

/** Anula um encargo (com motivo). Só sem pagamentos líquidos alocados — a BD repete a regra. */
export async function anularEncargo(
  actor: Principal,
  encargoId: string,
  motivo: string,
  ip?: string | null,
) {
  exigir(actor, "financeiro:editar");
  const m = analisar(motivoSchema, motivo);
  const id = analisar(uuid, encargoId);
  try {
    await comAuditoria(async (tx) => {
      const e = await tx.encargo.findUnique({ where: { id } });
      if (!e) throw new ErroValidacao(["Encargo inexistente."]);
      if (e.anuladoEm) throw new ErroValidacao(["O encargo já está anulado."]);
      const [r] = await tx.$queryRaw<
        { pago: bigint }[]
      >`SELECT encargo_pago_liquido(${id}::uuid) AS pago`;
      if (r && r.pago !== 0n)
        throw new ErroValidacao([
          "O encargo tem pagamentos alocados: estorne-os antes de o anular.",
        ]);
      await tx.encargo.update({
        where: { id },
        data: { anuladoEm: new Date(), anuladoPorId: actor.id, motivoAnulacao: m },
      });
      return {
        resultado: null,
        evento: {
          actorId: actor.id,
          acao: "ENCARGO_ANULADO",
          entidade: "Encargo",
          entidadeId: id,
          antes: { valor: e.valor },
          depois: { motivo: m },
          ip,
        },
      };
    });
  } catch (e) {
    if (e instanceof ErroValidacao || e instanceof ErroAutorizacao) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError)
      throw new ErroValidacao(["Não foi possível anular o encargo."]);
    throw e;
  }
}

// ── Pagamentos ───────────────────────────────────────────────────────────────

const pagamentoSchema = z.object({
  estudanteId: uuid,
  valorKz: kzSchema,
  metodo: z.enum(["TRANSFERENCIA", "DEPOSITO", "TPA", "NUMERARIO"]),
  dataPagamento: dataSchema,
  modoAlocacao: z.enum(["AUTOMATICO", "MANUAL"]).default("AUTOMATICO"),
  referenciaExterna: z.string().trim().max(80).optional(),
  nomePagador: z.string().trim().max(120).optional(),
});

/** Regista um pagamento: fica REGISTADO (sem efeito nas contas) até a Direcção o confirmar. */
export async function registarPagamento(actor: Principal, entrada: unknown, ctx: ContextoPedido) {
  exigir(actor, "financeiro:editar");
  const token = exigirSessao(ctx);
  const d = analisar(pagamentoSchema, entrada);
  if (d.dataPagamento.getTime() > hojeEmLuanda().getTime())
    throw new ErroValidacao(["A data do pagamento não pode ser futura."]);
  const r = await chamar(
    () => db.$queryRaw<{ id: string }[]>`
      SELECT registar_pagamento(${d.estudanteId}::uuid, ${d.valorKz}::bigint, ${d.metodo}::"MetodoPagamento",
        ${d.dataPagamento}::date, ${d.modoAlocacao}::"ModoAlocacao", ${d.referenciaExterna ?? null}, ${d.nomePagador ?? null},
        ${token}, ${ctx.ip ?? null}) AS id`,
  );
  return r[0]!.id;
}

export async function anularPagamento(
  actor: Principal,
  pagamentoId: string,
  motivo: string,
  ctx: ContextoPedido,
) {
  exigir(actor, "financeiro:editar");
  const token = exigirSessao(ctx);
  const id = analisar(uuid, pagamentoId);
  const m = analisar(motivoSchema, motivo);
  await chamar(
    () => db.$executeRaw`SELECT anular_pagamento(${id}::uuid, ${m}, ${token}, ${ctx.ip ?? null})`,
  );
}

/** Confirma (Direcção, pessoa diferente de quem registou): aloca ao encargo mais antigo e emite o recibo. Devolve o id do recibo. */
export async function confirmarPagamento(
  actor: Principal,
  pagamentoId: string,
  ctx: ContextoPedido,
) {
  exigir(actor, "pagamento:confirmar");
  const token = exigirSessao(ctx);
  const id = analisar(uuid, pagamentoId);
  const r = await chamar(
    () =>
      db.$queryRaw<
        { id: string }[]
      >`SELECT confirmar_pagamento(${id}::uuid, ${token}, ${ctx.ip ?? null}) AS id`,
  );
  // O aviso é uma conveniência: a confirmação e o recibo já estão gravados. Se o aviso falhar, fica registado na auditoria
  // (só ids) e a confirmação não é desfeita.
  try {
    const pag = await db.pagamento.findUniqueOrThrow({
      where: { id },
      select: { estudanteId: true },
    });
    await notificarReciboEmitido(db, pag.estudanteId, id);
  } catch {
    await registarAuditoria({
      actorId: actor.id,
      acao: "NOTIFICACAO_FALHOU",
      entidade: "Pagamento",
      entidadeId: id,
      ip: ctx.ip,
    });
  }
  return r[0]!.id;
}

export async function alocarManual(
  actor: Principal,
  entrada: { pagamentoId: string; encargoId: string; valorKz: string | number },
  ctx: ContextoPedido,
) {
  exigir(actor, "financeiro:editar");
  const token = exigirSessao(ctx);
  const pag = analisar(uuid, entrada.pagamentoId);
  const enc = analisar(uuid, entrada.encargoId);
  const valor = analisar(kzSchema, entrada.valorKz);
  await chamar(
    () =>
      db.$executeRaw`SELECT alocar_pagamento_manual(${pag}::uuid, ${enc}::uuid, ${valor}::bigint, ${token}, ${ctx.ip ?? null})`,
  );
}

// ── Estornos ─────────────────────────────────────────────────────────────────

export async function proporEstorno(
  actor: Principal,
  entrada: { pagamentoId: string; valorKz: string | number; motivo: string },
  ctx: ContextoPedido,
) {
  exigir(actor, "estorno:propor");
  const token = exigirSessao(ctx);
  const pag = analisar(uuid, entrada.pagamentoId);
  const valor = analisar(kzSchema, entrada.valorKz);
  const m = analisar(motivoSchema, entrada.motivo);
  const r = await chamar(
    () =>
      db.$queryRaw<
        { id: string }[]
      >`SELECT propor_estorno(${pag}::uuid, ${valor}::bigint, ${m}, ${token}, ${ctx.ip ?? null}) AS id`,
  );
  return r[0]!.id;
}

export async function aprovarEstorno(
  actor: Principal,
  estornoId: string,
  motivo: string | undefined,
  ctx: ContextoPedido,
) {
  exigir(actor, "estorno:aprovar");
  const token = exigirSessao(ctx);
  const id = analisar(uuid, estornoId);
  const m = (motivo ?? "").trim();
  if (m.length > 300) throw new ErroValidacao(["Motivo demasiado longo."]);
  await chamar(
    () => db.$executeRaw`SELECT aprovar_estorno(${id}::uuid, ${m}, ${token}, ${ctx.ip ?? null})`,
  );
}

export async function rejeitarEstorno(
  actor: Principal,
  estornoId: string,
  motivo: string,
  ctx: ContextoPedido,
) {
  exigir(actor, "estorno:aprovar");
  const token = exigirSessao(ctx);
  const id = analisar(uuid, estornoId);
  const m = analisar(motivoSchema, motivo);
  await chamar(
    () => db.$executeRaw`SELECT rejeitar_estorno(${id}::uuid, ${m}, ${token}, ${ctx.ip ?? null})`,
  );
}

/** Pesquisa de estudantes para o financeiro (nome ou n.º de processo; no máximo 10). Só gestão. */
export async function procurarEstudantes(actor: Principal, texto: string) {
  exigir(actor, "financeiro:ver");
  exigirGestao(actor);
  const q = texto.trim().slice(0, 80);
  if (q.length < 2) return [];
  return db.estudante.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: "insensitive" } },
        { numeroProcesso: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, nome: true, numeroProcesso: true },
    orderBy: { nome: "asc" },
    take: 10,
  });
}

// ── Leitura: contas, extracto e filas ────────────────────────────────────────

async function estudanteVisivel(actor: Principal, estudanteId: string) {
  exigir(actor, "financeiro:ver");
  const id = analisar(uuid, estudanteId);
  const e = await db.estudante.findFirst({
    where: { AND: [{ id }, escopoFinanceiro(actor)] },
    select: { id: true, nome: true, numeroProcesso: true },
  });
  if (!e) throw new ErroAutorizacao("Estudante não encontrado ou sem acesso.");
  return e;
}

/** Contas de um estudante (calculadas, nunca guardadas): em dívida, vencido e crédito (excedente ainda não alocado). */
export async function saldoDoEstudante(
  actor: Principal,
  estudanteId: string,
  agora: Date = new Date(),
) {
  const e = await estudanteVisivel(actor, estudanteId);
  return calcularSaldo(e.id, agora);
}

export async function calcularSaldo(
  estudanteId: string,
  agora: Date = new Date(),
  cliente: Pick<typeof db, "$queryRaw"> = db,
) {
  const hoje = hojeEmLuanda(agora);
  const [r] = await cliente.$queryRaw<
    { encargos: bigint; pago: bigint; vencido: bigint; credito: bigint }[]
  >`
    SELECT
      COALESCE((SELECT SUM(v.valor) FROM "VistaEncargo" v WHERE v."estudanteId" = ${estudanteId}::uuid AND v."anuladoEm" IS NULL), 0)::bigint AS encargos,
      COALESCE((SELECT SUM(v.pago) FROM "VistaEncargo" v WHERE v."estudanteId" = ${estudanteId}::uuid AND v."anuladoEm" IS NULL), 0)::bigint AS pago,
      COALESCE((SELECT SUM(v.valor - v.pago) FROM "VistaEncargo" v WHERE v."estudanteId" = ${estudanteId}::uuid AND v."anuladoEm" IS NULL AND v.vencimento < ${hoje}::date), 0)::bigint AS vencido,
      COALESCE((SELECT SUM(p.valor - pagamento_estornado_aprovado(p.id) - pagamento_alocado_liquido(p.id)) FROM "Pagamento" p
                 WHERE p."estudanteId" = ${estudanteId}::uuid AND p.estado IN ('CONFIRMADO', 'ESTORNADO')), 0)::bigint AS credito`;
  const encargos = r?.encargos ?? 0n;
  const pago = r?.pago ?? 0n;
  return {
    encargos,
    pago,
    emDivida: encargos - pago,
    vencido: r?.vencido ?? 0n,
    credito: r?.credito ?? 0n,
  };
}

/** Extracto do estudante: encargos (com estado), pagamentos (com recibo e estornos) e contas. */
export async function extractoDoEstudante(
  actor: Principal,
  estudanteId: string,
  agora: Date = new Date(),
) {
  const est = await estudanteVisivel(actor, estudanteId);
  const hoje = hojeEmLuanda(agora);
  const [encargos, pagamentos, saldo] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        referencia: string;
        descricao: string;
        valor: bigint;
        vencimento: Date;
        anuladoEm: Date | null;
        pago: bigint;
      }[]
    >`SELECT id, referencia, descricao, valor, vencimento, "anuladoEm", pago FROM "VistaEncargo"
       WHERE "estudanteId" = ${est.id}::uuid ORDER BY vencimento, id`,
    db.pagamento.findMany({
      where: { estudanteId: est.id },
      orderBy: [{ dataPagamento: "desc" }, { createdAt: "desc" }],
      include: { recibo: true, estornos: { orderBy: { propostoEm: "asc" } } },
    }),
    calcularSaldo(est.id, agora),
  ]);
  return {
    estudante: est,
    encargos: encargos.map((e) => ({
      ...e,
      estado: estadoEncargo(
        { valor: e.valor, pago: e.pago, vencimento: e.vencimento, anulado: !!e.anuladoEm },
        hoje,
      ),
    })),
    pagamentos,
    saldo,
  };
}

/** Fila de trabalho: pagamentos por confirmar / estornos por decidir (gestão). */
export async function pagamentosPorConfirmar(actor: Principal) {
  exigir(actor, "financeiro:ver");
  exigirGestao(actor);
  return db.pagamento.findMany({
    where: { estado: "REGISTADO" },
    orderBy: { createdAt: "asc" },
    include: { estudante: { select: { id: true, nome: true, numeroProcesso: true } } },
    take: 200,
  });
}

export async function estornosPorDecidir(actor: Principal) {
  exigir(actor, "financeiro:ver");
  exigirGestao(actor);
  return db.estorno.findMany({
    where: { estado: "PROPOSTO" },
    orderBy: { propostoEm: "asc" },
    include: {
      pagamento: {
        include: { estudante: { select: { id: true, nome: true, numeroProcesso: true } } },
      },
    },
    take: 200,
  });
}

/** Recibo de um pagamento (para o PDF): respeita o escopo do leitor. */
export async function obterRecibo(actor: Principal, pagamentoId: string) {
  exigir(actor, "financeiro:ver");
  const id = analisar(uuid, pagamentoId);
  const pag = await db.pagamento.findFirst({
    where: { id, estudante: escopoFinanceiro(actor) },
    include: { recibo: true, estudante: { select: { nome: true, numeroProcesso: true } } },
  });
  if (!pag || !pag.recibo) throw new ErroAutorizacao("Recibo não encontrado ou sem acesso.");
  const { recibo: reciboEmitido, ...pagamento } = pag;
  const r = { ...reciboEmitido, pagamento, estudante: pag.estudante };
  const alocacoes = await db.alocacaoPagamento.findMany({
    where: { pagamentoId: id },
    include: { encargo: { select: { descricao: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { recibo: r, alocacoes };
}

// ── Relatórios (gestão) ──────────────────────────────────────────────────────

function exigirRelatorio(actor: Principal) {
  exigirGestao(actor);
  if (!can(actor, "relatorios:ver")) throw new ErroAutorizacao();
}

/** Dívidas por turma: estudantes com matrícula ACTIVA numa turma e o que devem (total e vencido). */
export async function dividasPorTurma(actor: Principal, turmaId: string, agora: Date = new Date()) {
  exigirRelatorio(actor);
  const t = analisar(uuid, turmaId);
  const hoje = hojeEmLuanda(agora);
  const linhas = await db.$queryRaw<
    {
      estudanteId: string;
      nome: string;
      numeroProcesso: string;
      emDivida: bigint;
      vencido: bigint;
    }[]
  >`
    SELECT s.id AS "estudanteId", s.nome, s."numeroProcesso",
           COALESCE(SUM(v.valor - v.pago), 0)::bigint AS "emDivida",
           COALESCE(SUM(CASE WHEN v.vencimento < ${hoje}::date THEN v.valor - v.pago ELSE 0 END), 0)::bigint AS vencido
      FROM "Matricula" m
      JOIN "Estudante" s ON s.id = m."estudanteId"
      LEFT JOIN "VistaEncargo" v ON v."estudanteId" = s.id AND v."anuladoEm" IS NULL AND v."anoLectivoId" = m."anoLectivoId"
     WHERE m."turmaId" = ${t}::uuid AND m.estado = 'ACTIVA'
     GROUP BY s.id, s.nome, s."numeroProcesso"
     ORDER BY s.nome`;
  return {
    linhas,
    totalEmDivida: linhas.reduce((a, l) => a + l.emDivida, 0n),
    totalVencido: linhas.reduce((a, l) => a + l.vencido, 0n),
  };
}

const periodoSchema = z.object({ de: dataSchema, ate: dataSchema });

/** Recebimentos por período (data do pagamento): pagamentos confirmados, líquido de estornos aprovados, por método. */
export async function recebimentosPorPeriodo(
  actor: Principal,
  entrada: { de: string; ate: string },
) {
  exigirRelatorio(actor);
  const { de, ate } = analisar(periodoSchema, entrada);
  if (de.getTime() > ate.getTime())
    throw new ErroValidacao(["A data inicial é posterior à final."]);
  const porMetodo = await db.$queryRaw<
    { metodo: string; bruto: bigint; estornado: bigint; quantidade: bigint }[]
  >`
    SELECT p.metodo::text AS metodo, SUM(p.valor)::bigint AS bruto,
           SUM(pagamento_estornado_aprovado(p.id))::bigint AS estornado, COUNT(*)::bigint AS quantidade
      FROM "Pagamento" p
     WHERE p.estado IN ('CONFIRMADO', 'ESTORNADO') AND p."dataPagamento" BETWEEN ${de}::date AND ${ate}::date
     GROUP BY p.metodo ORDER BY p.metodo`;
  const bruto = porMetodo.reduce((a, l) => a + l.bruto, 0n);
  const estornado = porMetodo.reduce((a, l) => a + l.estornado, 0n);
  return { porMetodo, bruto, estornado, liquido: bruto - estornado };
}

/** Reconciliação (gestão): devolve as violações dos invariantes; vazio = coerente. */
export async function reconciliar(actor: Principal) {
  exigirRelatorio(actor);
  return db.$queryRaw<
    { verificacao: string; entidade_id: string; detalhe: string }[]
  >`SELECT * FROM reconciliacao_financeira(NULL)`;
}

export { referenciaMensal };
