import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { AUTH } from "./config";
import { gerarToken, hashToken } from "./tokens";
import { ehPapel, type Papel, type Principal } from "@/server/authz";

export interface UtilizadorSessao extends Principal {
  nome: string;
  email: string;
  sessaoId: string;
}

export async function criarSessao(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
) {
  const { token, tokenHash } = gerarToken();
  const expiraEm = new Date(Date.now() + AUTH.sessaoAbsolutaMs);
  const sessao = await db.session.create({
    data: {
      userId,
      tokenHash,
      expiraEm,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
  return { token, expiraEm, sessaoId: sessao.id };
}

/**
 * Valida o token a CADA pedido, na base de dados (revogação imediata):
 * sessão existente, não revogada, dentro do prazo absoluto e de inactividade, utilizador ACTIVO.
 * Os papéis são lidos agora, por isso uma alteração de papéis tem efeito de imediato.
 */
export async function validarSessao(
  token: string | undefined | null,
): Promise<UtilizadorSessao | null> {
  if (!token) return null;
  const agora = new Date();
  const s = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { papeis: { include: { role: true } } } } },
  });
  if (!s || s.revogadaEm) return null;
  if (s.expiraEm <= agora) return null;
  if (agora.getTime() - s.ultimaActividade.getTime() > AUTH.sessaoInactividadeMs) return null;
  if (s.user.estado !== "ACTIVO") return null;

  if (agora.getTime() - s.ultimaActividade.getTime() > AUTH.sessaoRefrescoMs) {
    await db.session.update({ where: { id: s.id }, data: { ultimaActividade: agora } });
  }
  const papeis = s.user.papeis.map((ur) => ur.role.codigo).filter(ehPapel) as Papel[];
  return { id: s.user.id, nome: s.user.nome, email: s.user.email, papeis, sessaoId: s.id };
}

export async function revogarSessaoPorToken(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.session.updateMany({
    where: { tokenHash: hashToken(token), revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

export async function revogarSessoesDoUtilizador(
  userId: string,
  actorId: string | null,
  motivo: string,
  ip?: string | null,
): Promise<number> {
  const r = await db.session.updateMany({
    where: { userId, revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
  if (r.count > 0) {
    await registarAuditoria({
      actorId,
      acao: "SESSOES_REVOGADAS",
      entidade: "User",
      entidadeId: userId,
      depois: { total: r.count, motivo },
      ip,
    });
  }
  return r.count;
}
