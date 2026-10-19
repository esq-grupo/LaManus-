import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { comAuditoria, registarAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { escopoPortal } from "@/server/authz/scope";
import { ErroAutorizacao, ErroValidacao, ehViolacaoUnica } from "@/server/erros";
import { hojeEmLuanda } from "@/lib/datas";
import { formatarKz } from "@/lib/dinheiro";
import { TIPOS_DECLARACAO, type DadosDeclaracao } from "@/lib/declaracoes";
import { calcularSaldo } from "./financeiro";
import { notificarPedido } from "./notificacoes";

// Entrega G — pedidos de declarações, aprovação, emissão e descarga (ADR-0006).

const uuid = z.string().uuid("Identificador inválido.");
const motivoSchema = z.string().trim().min(5, "Indique o motivo (mínimo 5 caracteres).").max(300);
const pedidoSchema = z.object({
  estudanteId: uuid,
  tipo: z.enum(TIPOS_DECLARACAO, { message: "Tipo de declaração inválido." }),
  finalidade: z.string().trim().min(3, "Indique a finalidade (ex.: para a embaixada).").max(300),
});

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

function gestao(actor: Principal) {
  return can(actor, "declaracoes:emitir") || can(actor, "declaracoes:aprovar");
}

/** Quem pode tratar pedidos DESTE estudante em nome próprio ou da família: portal (escopo) ou Secretaria. */
async function podePedirPor(actor: Principal, estudanteId: string): Promise<boolean> {
  if (can(actor, "declaracoes:emitir"))
    return !!(await db.estudante.findFirst({
      where: { id: estudanteId, archivedAt: null },
      select: { id: true },
    }));
  if (!can(actor, "declaracoes:pedir")) return false;
  return !!(await db.estudante.findFirst({
    where: { AND: [{ id: estudanteId }, escopoPortal(actor), { archivedAt: null }] },
    select: { id: true },
  }));
}

// ── Pedir / cancelar ─────────────────────────────────────────────────────────

export async function pedirDeclaracao(actor: Principal, entrada: unknown, ip?: string | null) {
  const d = analisar(pedidoSchema, entrada);
  if (!(await podePedirPor(actor, d.estudanteId))) throw new ErroAutorizacao();
  const mat = await db.matricula.findFirst({
    where: { estudanteId: d.estudanteId, estado: "ACTIVA" },
    orderBy: { data: "desc" },
    select: { anoLectivoId: true },
  });
  if (!mat)
    throw new ErroValidacao([
      "O estudante não tem matrícula activa: não é possível pedir a declaração.",
    ]);
  const aberto = await db.pedidoDeclaracao.findFirst({
    where: { estudanteId: d.estudanteId, tipo: d.tipo, estado: { in: ["PEDIDO", "APROVADO"] } },
    select: { id: true },
  });
  if (aberto)
    throw new ErroValidacao(["Já existe um pedido deste tipo em curso para este estudante."]);
  return comAuditoria(async (tx) => {
    const p = await tx.pedidoDeclaracao.create({
      data: {
        estudanteId: d.estudanteId,
        anoLectivoId: mat.anoLectivoId,
        tipo: d.tipo,
        finalidade: d.finalidade,
        pedidoPorId: actor.id,
      },
    });
    return {
      resultado: p,
      evento: {
        actorId: actor.id,
        acao: "DECLARACAO_PEDIDA",
        entidade: "PedidoDeclaracao",
        entidadeId: p.id,
        depois: { tipo: d.tipo, estudanteId: d.estudanteId },
        ip,
      },
    };
  });
}

export async function cancelarPedido(actor: Principal, pedidoId: string, ip?: string | null) {
  const id = analisar(uuid, pedidoId);
  await comAuditoria(async (tx) => {
    const p = await tx.pedidoDeclaracao.findUnique({ where: { id } });
    // só o próprio requerente cancela; para os outros o pedido «não existe»
    if (!p || p.pedidoPorId !== actor.id) throw new ErroAutorizacao();
    if (p.estado !== "PEDIDO")
      throw new ErroValidacao(["Só se cancela um pedido ainda por decidir."]);
    await tx.pedidoDeclaracao.update({
      where: { id },
      data: { estado: "CANCELADO", canceladoEm: new Date() },
    });
    return {
      resultado: null,
      evento: {
        actorId: actor.id,
        acao: "DECLARACAO_CANCELADA",
        entidade: "PedidoDeclaracao",
        entidadeId: id,
        ip,
      },
    };
  });
}

// ── Decidir (Direcção) ───────────────────────────────────────────────────────

export async function decidirPedido(
  actor: Principal,
  pedidoId: string,
  decisao: "APROVAR" | "REJEITAR",
  motivo: string | undefined,
  ip?: string | null,
) {
  if (!can(actor, "declaracoes:aprovar")) throw new ErroAutorizacao();
  const id = analisar(uuid, pedidoId);
  const m =
    decisao === "REJEITAR"
      ? analisar(motivoSchema, motivo)
      : (motivo ?? "").trim().slice(0, 300) || null;
  try {
    await comAuditoria(async (tx) => {
      const p = await tx.pedidoDeclaracao.findUnique({ where: { id } });
      if (!p) throw new ErroValidacao(["Pedido inexistente."]);
      if (p.estado !== "PEDIDO")
        throw new ErroValidacao(["O pedido já foi decidido ou cancelado."]);
      if (p.pedidoPorId === actor.id)
        throw new ErroValidacao(["Não pode decidir um pedido feito por si."]);
      const novo = decisao === "APROVAR" ? "APROVADO" : "REJEITADO";
      await tx.pedidoDeclaracao.update({
        where: { id },
        data: { estado: novo, decididoPorId: actor.id, decididoEm: new Date(), motivoDecisao: m },
      });
      await notificarPedido(tx, {
        userId: p.pedidoPorId,
        estudanteId: p.estudanteId,
        pedidoId: id,
        tipo: decisao === "APROVAR" ? "PEDIDO_APROVADO" : "PEDIDO_REJEITADO",
      });
      return {
        resultado: null,
        evento: {
          actorId: actor.id,
          acao: decisao === "APROVAR" ? "DECLARACAO_APROVADA" : "DECLARACAO_REJEITADA",
          entidade: "PedidoDeclaracao",
          entidadeId: id,
          antes: { estado: "PEDIDO" },
          depois: { estado: novo, motivo: m },
          ip,
        },
      };
    });
  } catch (e) {
    if (e instanceof ErroValidacao || e instanceof ErroAutorizacao) throw e;
    throw new ErroValidacao(["Não foi possível registar a decisão."]);
  }
}

// ── Emitir (Secretaria) ──────────────────────────────────────────────────────

/** Valida os dados NA EMISSÃO e devolve o instantâneo que fica gravado. */
async function montarDados(
  p: { estudanteId: string; anoLectivoId: string; tipo: DadosDeclaracao["tipo"] },
  agora: Date,
): Promise<DadosDeclaracao> {
  const mat = await db.matricula.findFirst({
    where: { estudanteId: p.estudanteId, anoLectivoId: p.anoLectivoId, estado: "ACTIVA" },
    include: { turma: { include: { classe: true } }, anoLectivo: true, estudante: true },
  });
  if (!mat)
    throw new ErroValidacao([
      "O estudante já não tem matrícula activa neste ano lectivo: não se pode emitir.",
    ]);
  if (p.tipo === "SITUACAO_FINANCEIRA") {
    const s = await calcularSaldo(p.estudanteId, agora);
    if (s.vencido > 0n)
      throw new ErroValidacao([
        `Existem valores em atraso (${formatarKz(s.vencido)}): não se pode emitir a declaração de situação financeira.`,
      ]);
  }
  return {
    tipo: p.tipo,
    nome: mat.estudante.nome,
    numeroProcesso: mat.estudante.numeroProcesso,
    dataNascimento: mat.estudante.dataNascimento.toISOString().slice(0, 10),
    classe: mat.turma.classe.nome,
    turma: mat.turma.nome,
    turno: mat.turma.turno,
    anoLectivo: mat.anoLectivo.nome,
  };
}

export async function emitirDeclaracao(
  actor: Principal,
  pedidoId: string,
  ip?: string | null,
  agora = new Date(),
) {
  if (!can(actor, "declaracoes:emitir")) throw new ErroAutorizacao();
  const id = analisar(uuid, pedidoId);
  const p0 = await db.pedidoDeclaracao.findUnique({ where: { id } });
  if (!p0) throw new ErroValidacao(["Pedido inexistente."]);
  if (p0.estado !== "APROVADO") throw new ErroValidacao(["Só se emite um pedido aprovado."]);
  if (p0.decididoPorId === actor.id)
    throw new ErroValidacao(["Quem aprovou o pedido não o pode emitir."]);
  const dados = await montarDados(p0, agora);
  const ano = Number(hojeEmLuanda(agora).toISOString().slice(0, 4));
  try {
    return await comAuditoria(async (tx) => {
      const p = await tx.pedidoDeclaracao.findUnique({ where: { id } });
      if (!p || p.estado !== "APROVADO")
        throw new ErroValidacao(["O pedido já não está por emitir."]);
      // Número sem saltos: linha do contador bloqueada até ao fim desta transacção (se falhar, o número volta atrás).
      await tx.$executeRaw`INSERT INTO "SerieDocumento" (serie, ano, proximo) VALUES ('D', ${ano}, 1) ON CONFLICT (serie, ano) DO NOTHING`;
      const [serie] = await tx.$queryRaw<
        { proximo: number }[]
      >`SELECT proximo FROM "SerieDocumento" WHERE serie = 'D' AND ano = ${ano} FOR UPDATE`;
      const numero = serie!.proximo;
      await tx.$executeRaw`UPDATE "SerieDocumento" SET proximo = ${numero + 1} WHERE serie = 'D' AND ano = ${ano}`;
      const doc = await tx.declaracaoEmitida.create({
        data: {
          pedidoId: id,
          serie: "D",
          ano,
          numero,
          codigo: randomBytes(8).toString("hex").toUpperCase(),
          dados: { ...dados },
        },
      });
      await tx.pedidoDeclaracao.update({
        where: { id },
        data: { estado: "EMITIDA", emitidoPorId: actor.id, emitidoEm: new Date() },
      });
      await notificarPedido(tx, {
        userId: p.pedidoPorId,
        estudanteId: p.estudanteId,
        pedidoId: id,
        tipo: "DECLARACAO_EMITIDA",
      });
      return {
        resultado: doc,
        evento: {
          actorId: actor.id,
          acao: "DECLARACAO_EMITIDA",
          entidade: "PedidoDeclaracao",
          entidadeId: id,
          antes: { estado: "APROVADO" },
          depois: { estado: "EMITIDA", numero: `D/${ano}/${numero}` },
          ip,
        },
      };
    });
  } catch (e) {
    if (ehViolacaoUnica(e))
      throw new ErroValidacao(["Conflito ao numerar o documento. Tente novamente."]);
    throw e;
  }
}

// ── Leitura ──────────────────────────────────────────────────────────────────

const selecao = {
  id: true,
  tipo: true,
  finalidade: true,
  estado: true,
  createdAt: true,
  motivoDecisao: true,
  estudanteId: true,
  estudante: { select: { id: true, nome: true, numeroProcesso: true } },
  emitida: { select: { serie: true, ano: true, numero: true } },
} as const;

/** Pedidos do portal: os dos educandos a que o utilizador tem acesso (próprio / encarregado verificado e activo). */
export async function pedidosDoPortal(actor: Principal) {
  if (!can(actor, "declaracoes:pedir")) throw new ErroAutorizacao();
  return db.pedidoDeclaracao.findMany({
    where: { estudante: { AND: [escopoPortal(actor), { archivedAt: null }] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: selecao,
  });
}

/** Filas de trabalho da gestão: a Direcção vê os por decidir; a Secretaria os aprovados por emitir. */
export async function filaDePedidos(actor: Principal) {
  if (!gestao(actor)) throw new ErroAutorizacao();
  const estados: ("PEDIDO" | "APROVADO")[] = [];
  if (can(actor, "declaracoes:aprovar")) estados.push("PEDIDO");
  if (can(actor, "declaracoes:emitir")) estados.push("APROVADO");
  return db.pedidoDeclaracao.findMany({
    where: { estado: { in: estados } },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { ...selecao, pedidoPorId: true },
  });
}

/** Documento emitido para descarga. «Não existe» e «sem acesso» são o mesmo erro. Cada descarga fica auditada. */
export async function obterDocumento(actor: Principal, pedidoId: string, ip?: string | null) {
  const id = z.string().uuid().safeParse(pedidoId);
  if (!id.success) throw new ErroAutorizacao();
  const pedido = await db.pedidoDeclaracao.findFirst({
    where: gestao(actor)
      ? { id: id.data, estado: "EMITIDA" }
      : { id: id.data, estado: "EMITIDA", estudante: escopoPortal(actor) },
    include: { emitida: true },
  });
  const permitido = gestao(actor) || can(actor, "declaracoes:pedir");
  if (!pedido?.emitida || !permitido) throw new ErroAutorizacao();
  await registarAuditoria({
    actorId: actor.id,
    acao: "DECLARACAO_DESCARREGADA",
    entidade: "PedidoDeclaracao",
    entidadeId: pedido.id,
    ip,
  });
  return {
    pedido,
    documento: pedido.emitida,
    dados: pedido.emitida.dados as unknown as DadosDeclaracao,
  };
}
