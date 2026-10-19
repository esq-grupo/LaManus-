import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { hojeEmLuanda } from "@/lib/datas";
import { escopoPortal } from "@/server/authz/scope";
import type { Principal } from "@/server/authz";

// Entrega F — avisos do portal. Cada aviso tem UM destinatário e só ele o lê (o destinatário vem sempre da sessão).
// Os textos são genéricos: NUNCA incluem notas, valores nem dados de outras pessoas.

type Cliente = Pick<
  Prisma.TransactionClient,
  "notificacao" | "estudanteEncarregado" | "estudante" | "matricula"
>;

interface Destino {
  userId: string;
  estudanteId: string;
}

/** Contas que recebem avisos sobre um estudante: a do próprio e as dos encarregados com ligação verificada, activa e na validade. */
export async function destinatariosDoEstudante(
  cliente: Cliente,
  estudanteIds: string[],
  agora = new Date(),
): Promise<Destino[]> {
  if (estudanteIds.length === 0) return [];
  const d = hojeEmLuanda(agora);
  const [proprios, ligacoes] = await Promise.all([
    cliente.estudante.findMany({
      where: { id: { in: estudanteIds }, userId: { not: null } },
      select: { id: true, userId: true },
    }),
    cliente.estudanteEncarregado.findMany({
      where: {
        estudanteId: { in: estudanteIds },
        verificado: true,
        autorizacaoActiva: true,
        encarregado: { userId: { not: null }, archivedAt: null },
        AND: [
          { OR: [{ validoDe: null }, { validoDe: { lte: d } }] },
          { OR: [{ validoAte: null }, { validoAte: { gte: d } }] },
        ],
      },
      select: { estudanteId: true, encarregado: { select: { userId: true } } },
    }),
  ]);
  const out: Destino[] = proprios.map((e) => ({ userId: e.userId!, estudanteId: e.id }));
  for (const l of ligacoes) out.push({ userId: l.encarregado.userId!, estudanteId: l.estudanteId });
  return out;
}

async function criar(
  cliente: Cliente,
  destinos: Destino[],
  dados: {
    tipo: "PAUTA_PUBLICADA" | "NOTA_CORRIGIDA" | "RECIBO_EMITIDO";
    titulo: string;
    corpo: string;
    chave: (d: Destino) => string;
  },
) {
  if (destinos.length === 0) return 0;
  const r = await cliente.notificacao.createMany({
    data: destinos.map((d) => ({
      userId: d.userId,
      estudanteId: d.estudanteId,
      tipo: dados.tipo,
      titulo: dados.titulo,
      corpo: dados.corpo,
      chave: dados.chave(d),
    })),
    skipDuplicates: true,
  });
  return r.count;
}

/** Pauta publicada: avisa os estudantes da turma e os seus encarregados. Chamar na MESMA transacção da publicação. */
export async function notificarPautaPublicada(
  cliente: Cliente,
  turmaId: string,
  periodoId: string,
) {
  const mats = await cliente.matricula.findMany({
    where: { turmaId, estado: "ACTIVA" },
    select: { estudanteId: true },
    distinct: ["estudanteId"],
  });
  const destinos = await destinatariosDoEstudante(
    cliente,
    mats.map((m) => m.estudanteId),
  );
  return criar(cliente, destinos, {
    tipo: "PAUTA_PUBLICADA",
    titulo: "Novas notas publicadas",
    corpo: "Foi publicada uma pauta. Já pode ver as notas na secção «Notas».",
    chave: (d) => `pauta:${turmaId}:${periodoId}:${d.estudanteId}`,
  });
}

/** Nota corrigida depois de publicada. A chave inclui o instante para que cada correcção gere o seu aviso. */
export async function notificarNotaCorrigida(
  cliente: Cliente,
  estudanteId: string,
  notaId: string,
) {
  const destinos = await destinatariosDoEstudante(cliente, [estudanteId]);
  return criar(cliente, destinos, {
    tipo: "NOTA_CORRIGIDA",
    titulo: "Nota corrigida",
    corpo: "Uma nota publicada foi corrigida pela Direcção. Veja a secção «Notas».",
    chave: (d) => `nota:${notaId}:${d.estudanteId}:${Date.now()}`,
  });
}

export async function notificarReciboEmitido(
  cliente: Cliente,
  estudanteId: string,
  pagamentoId: string,
) {
  const destinos = await destinatariosDoEstudante(cliente, [estudanteId]);
  return criar(cliente, destinos, {
    tipo: "RECIBO_EMITIDO",
    titulo: "Recibo emitido",
    corpo: "Foi confirmado um pagamento e emitido o recibo. Veja a secção «Contas».",
    chave: (d) => `recibo:${pagamentoId}:${d.estudanteId}`,
  });
}

// ── Leitura (só o próprio destinatário) ──────────────────────────────────────

/** Avisos que o utilizador pode ver agora: os seus, e (se ligados a um educando) só enquanto ainda tem acesso a esse educando. */
function visiveis(actor: Principal): Prisma.NotificacaoWhereInput {
  return {
    userId: actor.id,
    OR: [{ estudanteId: null }, { estudante: escopoPortal(actor) }],
  };
}

export async function listarAvisos(actor: Principal, opcoes: { limite?: number } = {}) {
  return db.notificacao.findMany({
    where: visiveis(actor),
    orderBy: { createdAt: "desc" },
    take: Math.min(opcoes.limite ?? 30, 100),
    select: {
      id: true,
      tipo: true,
      titulo: true,
      corpo: true,
      lidaEm: true,
      createdAt: true,
      estudante: { select: { id: true, nome: true } },
    },
  });
}

export async function contarNaoLidos(actor: Principal) {
  return db.notificacao.count({ where: { ...visiveis(actor), lidaEm: null } });
}

/** Marca como lido um aviso SEU (filtra sempre por destinatário: o id sozinho nunca chega). */
export async function marcarLido(actor: Principal, id: string) {
  const r = await db.notificacao.updateMany({
    where: { id, userId: actor.id, lidaEm: null },
    data: { lidaEm: new Date() },
  });
  return r.count;
}

export async function marcarTodosLidos(actor: Principal) {
  const r = await db.notificacao.updateMany({
    where: { userId: actor.id, lidaEm: null },
    data: { lidaEm: new Date() },
  });
  return r.count;
}
