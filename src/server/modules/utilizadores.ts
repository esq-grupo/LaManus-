import { z } from "zod";
import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { can, ehPapel, podeAlterarPapeis, type Papel, type Principal } from "@/server/authz";
import { hashPassword } from "@/server/auth/password";
import { enviarLinkDeRedefinicao } from "@/server/auth/recuperacao";
import { randomBytes } from "node:crypto";

import { ErroAutorizacao, ErroValidacao } from "@/server/erros";

export { ErroAutorizacao, ErroValidacao };

function exigir(actor: Principal, permissao: "utilizadores:gerir" | "utilizadores:ver") {
  if (!can(actor, permissao)) throw new ErroAutorizacao();
}

/** Falha de envio → mensagem clara para o administrador (sem detalhes técnicos) e evento de auditoria. */
async function enviarConvite(
  userId: string,
  actorId: string,
  ip: string | null | undefined,
  mensagem: string,
) {
  try {
    await enviarLinkDeRedefinicao(userId, "CONVITE", actorId, ip);
  } catch {
    await registarAuditoria({
      actorId,
      acao: "CONVITE_EMAIL_FALHOU",
      entidade: "User",
      entidadeId: userId,
      ip,
    });
    throw new ErroValidacao([`${mensagem} Use «Reenviar link» quando o email estiver disponível.`]);
  }
}

export const criarUtilizadorSchema = z.object({
  nome: z.string().trim().min(3, "Indique o nome.").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido.").max(200),
  papeis: z
    .array(z.string())
    .min(1, "Escolha pelo menos um papel.")
    .refine((p) => p.every(ehPapel), "Papel inválido."),
});

const incluirPapeis = { papeis: { include: { role: true } } } as const;

export const LIMITE_LISTA_UTILIZADORES = 50;
const LIMITE_MAXIMO_LISTA_UTILIZADORES = 200;

export function limparPesquisaUtilizadores(q?: string) {
  return (q ?? "").trim().slice(0, 80);
}

function filtroUtilizadores(q?: string) {
  const t = limparPesquisaUtilizadores(q);
  return t
    ? {
        OR: [
          { nome: { contains: t, mode: "insensitive" as const } },
          { email: { contains: t, mode: "insensitive" as const } },
        ],
      }
    : {};
}

function limiteUtilizadores(limite?: number) {
  return Math.max(
    1,
    Math.min(limite ?? LIMITE_LISTA_UTILIZADORES, LIMITE_MAXIMO_LISTA_UTILIZADORES),
  );
}

function paginaUtilizadores(pagina?: string) {
  if (typeof pagina !== "string" || !/^\d{1,6}$/.test(pagina)) return 1;
  const n = Number(pagina);
  return n >= 1 ? n : 1;
}

function apresentarUtilizador(u: {
  id: string;
  nome: string;
  email: string;
  estado: "ACTIVO" | "BLOQUEADO" | "DESACTIVADO";
  ultimoLogin: Date | null;
  papeis: { role: { codigo: string } }[];
}) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    estado: u.estado,
    ultimoLogin: u.ultimoLogin,
    papeis: u.papeis.map((ur) => ur.role.codigo).filter(ehPapel) as Papel[],
  };
}

/** Lista limitada (a escola terá milhares de contas de estudantes/encarregados): pesquisa por nome ou email. */
export async function listarUtilizadores(
  actor: Principal,
  filtro: { q?: string; limite?: number; pagina?: string } = {},
) {
  exigir(actor, "utilizadores:ver");
  if (filtro.pagina !== undefined) return (await paginarUtilizadores(actor, filtro)).itens;
  const users = await db.user.findMany({
    where: filtroUtilizadores(filtro.q),
    orderBy: [{ nome: "asc" }, { email: "asc" }, { id: "asc" }],
    take: limiteUtilizadores(filtro.limite),
    include: incluirPapeis,
  });
  return users.map(apresentarUtilizador);
}

export async function paginarUtilizadores(
  actor: Principal,
  filtro: { q?: string; limite?: number; pagina?: string } = {},
) {
  exigir(actor, "utilizadores:ver");
  const where = filtroUtilizadores(filtro.q);
  const limite = limiteUtilizadores(filtro.limite);
  const total = await db.user.count({ where });
  const paginas = Math.max(1, Math.ceil(total / limite));
  const pagina = Math.min(paginaUtilizadores(filtro.pagina), paginas);
  const skip = (pagina - 1) * limite;
  const users = await db.user.findMany({
    where,
    orderBy: [{ nome: "asc" }, { email: "asc" }, { id: "asc" }],
    skip,
    take: limite,
    include: incluirPapeis,
  });
  const itens = users.map(apresentarUtilizador);
  return {
    itens,
    total,
    pagina,
    paginas,
    de: total === 0 ? 0 : skip + 1,
    ate: total === 0 ? 0 : skip + itens.length,
  };
}

export async function contarUtilizadores(actor: Principal, q?: string) {
  exigir(actor, "utilizadores:ver");
  return db.user.count({ where: filtroUtilizadores(q) });
}

export interface ContextoAdmin {
  tokenSessao: string | null;
  ip?: string | null;
}

function exigirToken(ctx: ContextoAdmin): string {
  if (!ctx.tokenSessao) throw new ErroAutorizacao("Sessão inválida.");
  return ctx.tokenSessao;
}

/** A BD recusou: sessão/permissão → erro de autorização; regras de negócio → mensagem clara (sem detalhes técnicos). */
async function chamar<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = String((e as { message?: string }).message ?? "");
    if (/Sessão inválida|Sem permissão \(/.test(msg))
      throw new ErroAutorizacao("Sessão inválida ou sem permissão para esta operação.");
    if (/Não pode alterar os seus próprios papéis/.test(msg))
      throw new ErroAutorizacao("Não pode alterar os seus próprios papéis.");
    if (/Não pode alterar o estado da sua própria conta/.test(msg))
      throw new ErroAutorizacao("Não pode alterar o estado da sua própria conta.");
    if (/Utilizador inexistente|Papel inexistente|Indique pelo menos um papel/.test(msg))
      throw new ErroValidacao([
        msg.match(/Utilizador inexistente|Papel inexistente|Indique pelo menos um papel/)![0],
      ]);
    if ((e as { code?: string }).code === "P2010" && /23505|unique/i.test(msg))
      throw new ErroValidacao(["Já existe um utilizador com esse email."]);
    throw e;
  }
}

/**
 * O administrador nunca vê nem define palavras-passe: a conta nasce com uma inutilizável e o utilizador define a sua pelo link.
 * A conta e os papéis são criados por uma função da BD que autentica o autor pela SESSÃO (ADR-0008).
 */
export async function criarUtilizador(actor: Principal, entrada: unknown, ctx: ContextoAdmin) {
  exigir(actor, "utilizadores:gerir");
  const token = exigirToken(ctx);
  const r = criarUtilizadorSchema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  const { nome, email, papeis } = r.data;
  if (await db.user.findUnique({ where: { email } }))
    throw new ErroValidacao(["Já existe um utilizador com esse email."]);

  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const [linha] = await chamar(
    () =>
      db.$queryRaw<{ id: string }[]>`
        SELECT criar_utilizador(${token}, ${email}, ${nome}, ${passwordHash}, ${papeis}::text[], ${ctx.ip ?? null}) AS id`,
  );
  const id = linha!.id;
  await enviarConvite(
    id,
    actor.id,
    ctx.ip,
    "Utilizador criado, mas não foi possível enviar o email.",
  );
  return id;
}

export async function alterarPapeis(
  actor: Principal,
  alvoId: string,
  papeisNovos: string[],
  ctx: ContextoAdmin,
) {
  exigir(actor, "utilizadores:gerir");
  const token = exigirToken(ctx);
  if (!podeAlterarPapeis(actor, alvoId)) {
    await registarAuditoria({
      actorId: actor.id,
      acao: "ACESSO_NEGADO",
      entidade: "User",
      entidadeId: alvoId,
      depois: { tentativa: "alterar próprios papéis" },
      ip: ctx.ip,
    });
    throw new ErroAutorizacao("Não pode alterar os seus próprios papéis.");
  }
  if (papeisNovos.length === 0 || !papeisNovos.every(ehPapel))
    throw new ErroValidacao(["Papéis inválidos."]);
  await chamar(
    () =>
      db.$executeRaw`SELECT definir_papeis(${token}, ${alvoId}::uuid, ${papeisNovos}::text[], ${ctx.ip ?? null})`,
  );
}

export async function definirEstado(
  actor: Principal,
  alvoId: string,
  estado: "ACTIVO" | "DESACTIVADO",
  ctx: ContextoAdmin,
) {
  exigir(actor, "utilizadores:gerir");
  const token = exigirToken(ctx);
  if (actor.id === alvoId)
    throw new ErroAutorizacao("Não pode alterar o estado da sua própria conta.");
  await chamar(
    () =>
      db.$executeRaw`SELECT definir_estado_utilizador(${token}, ${alvoId}::uuid, ${estado}, ${ctx.ip ?? null})`,
  );
}

export async function revogarSessoesDe(actor: Principal, alvoId: string, ctx: ContextoAdmin) {
  exigir(actor, "utilizadores:gerir");
  const token = exigirToken(ctx);
  const [linha] = await chamar(
    () =>
      db.$queryRaw<
        { n: number }[]
      >`SELECT revogar_sessoes_utilizador(${token}, ${alvoId}::uuid, ${ctx.ip ?? null}) AS n`,
  );
  return linha!.n;
}

export async function reenviarConvite(actor: Principal, alvoId: string, ip?: string | null) {
  exigir(actor, "utilizadores:gerir");
  await enviarConvite(alvoId, actor.id, ip, "Não foi possível enviar o email.");
}
