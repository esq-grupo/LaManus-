import { z } from "zod";
import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { can, ehPapel, podeAlterarPapeis, type Papel, type Principal } from "@/server/authz";
import { hashPassword } from "@/server/auth/password";
import { enviarLinkDeRedefinicao } from "@/server/auth/recuperacao";
import { revogarSessoesDoUtilizador } from "@/server/auth/sessao";
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

function filtroUtilizadores(q?: string) {
  const t = (q ?? "").trim().slice(0, 80);
  return t
    ? {
        OR: [
          { nome: { contains: t, mode: "insensitive" as const } },
          { email: { contains: t, mode: "insensitive" as const } },
        ],
      }
    : {};
}

/** Lista limitada (a escola terá milhares de contas de estudantes/encarregados): pesquisa por nome ou email. */
export async function listarUtilizadores(
  actor: Principal,
  filtro: { q?: string; limite?: number } = {},
) {
  exigir(actor, "utilizadores:ver");
  const users = await db.user.findMany({
    where: filtroUtilizadores(filtro.q),
    orderBy: [{ nome: "asc" }, { email: "asc" }],
    take: Math.min(filtro.limite ?? LIMITE_LISTA_UTILIZADORES, 200),
    include: incluirPapeis,
  });
  return users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    estado: u.estado,
    ultimoLogin: u.ultimoLogin,
    papeis: u.papeis.map((ur) => ur.role.codigo).filter(ehPapel) as Papel[],
  }));
}

export async function contarUtilizadores(actor: Principal, q?: string) {
  exigir(actor, "utilizadores:ver");
  return db.user.count({ where: filtroUtilizadores(q) });
}

async function idsDePapeis(codigos: string[]) {
  const roles = await db.role.findMany({ where: { codigo: { in: codigos } } });
  if (roles.length !== new Set(codigos).size) throw new ErroValidacao(["Papel inexistente."]);
  return roles.map((r) => r.id);
}

/** O administrador nunca vê nem define palavras-passe: a conta nasce com uma inutilizável e o utilizador define a sua pelo link. */
export async function criarUtilizador(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "utilizadores:gerir");
  const r = criarUtilizadorSchema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  const { nome, email, papeis } = r.data;
  if (await db.user.findUnique({ where: { email } }))
    throw new ErroValidacao(["Já existe um utilizador com esse email."]);

  const roleIds = await idsDePapeis(papeis);
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const user = await db.user.create({
    data: { nome, email, passwordHash, papeis: { create: roleIds.map((roleId) => ({ roleId })) } },
  });
  await registarAuditoria({
    actorId: actor.id,
    acao: "UTILIZADOR_CRIADO",
    entidade: "User",
    entidadeId: user.id,
    depois: { nome, email, papeis },
    ip,
  });
  await enviarConvite(
    user.id,
    actor.id,
    ip,
    "Utilizador criado, mas não foi possível enviar o email.",
  );
  return user.id;
}

export async function alterarPapeis(
  actor: Principal,
  alvoId: string,
  papeisNovos: string[],
  ip?: string | null,
) {
  exigir(actor, "utilizadores:gerir");
  if (!podeAlterarPapeis(actor, alvoId)) {
    await registarAuditoria({
      actorId: actor.id,
      acao: "ACESSO_NEGADO",
      entidade: "User",
      entidadeId: alvoId,
      depois: { tentativa: "alterar próprios papéis" },
      ip,
    });
    throw new ErroAutorizacao("Não pode alterar os seus próprios papéis.");
  }
  if (papeisNovos.length === 0 || !papeisNovos.every(ehPapel))
    throw new ErroValidacao(["Papéis inválidos."]);
  const alvo = await db.user.findUnique({ where: { id: alvoId }, include: incluirPapeis });
  if (!alvo) throw new ErroValidacao(["Utilizador inexistente."]);
  const antes = alvo.papeis.map((ur) => ur.role.codigo).sort();
  const roleIds = await idsDePapeis(papeisNovos);
  await db.$transaction([
    db.userRole.deleteMany({ where: { userId: alvoId } }),
    db.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: alvoId, roleId })) }),
  ]);
  await registarAuditoria({
    actorId: actor.id,
    acao: "PAPEIS_ALTERADOS",
    entidade: "User",
    entidadeId: alvoId,
    antes: { papeis: antes },
    depois: { papeis: [...papeisNovos].sort() },
    ip,
  });
}

export async function definirEstado(
  actor: Principal,
  alvoId: string,
  estado: "ACTIVO" | "DESACTIVADO",
  ip?: string | null,
) {
  exigir(actor, "utilizadores:gerir");
  if (actor.id === alvoId)
    throw new ErroAutorizacao("Não pode alterar o estado da sua própria conta.");
  const alvo = await db.user.findUnique({ where: { id: alvoId } });
  if (!alvo) throw new ErroValidacao(["Utilizador inexistente."]);
  await db.user.update({
    where: { id: alvoId },
    data: { estado, tentativasFalhadas: 0, bloqueadoAte: null },
  });
  if (estado === "DESACTIVADO")
    await revogarSessoesDoUtilizador(alvoId, actor.id, "conta desactivada", ip);
  await registarAuditoria({
    actorId: actor.id,
    acao: estado === "ACTIVO" ? "UTILIZADOR_REACTIVADO" : "UTILIZADOR_DESACTIVADO",
    entidade: "User",
    entidadeId: alvoId,
    antes: { estado: alvo.estado },
    depois: { estado },
    ip,
  });
}

export async function revogarSessoesDe(actor: Principal, alvoId: string, ip?: string | null) {
  exigir(actor, "utilizadores:gerir");
  return revogarSessoesDoUtilizador(alvoId, actor.id, "revogação pelo administrador", ip);
}

export async function reenviarConvite(actor: Principal, alvoId: string, ip?: string | null) {
  exigir(actor, "utilizadores:gerir");
  await enviarConvite(alvoId, actor.id, ip, "Não foi possível enviar o email.");
}
