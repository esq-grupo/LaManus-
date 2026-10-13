import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { AUTH } from "./config";
import { gastarTempoDeVerificacao, verificarPassword } from "./password";
import { criarSessao } from "./sessao";

export interface MetaPedido {
  ip?: string | null;
  userAgent?: string | null;
}

export type ResultadoLogin =
  | { ok: true; token: string; expiraEm: Date; userId: string }
  | { ok: false; motivo: "CREDENCIAIS" | "BLOQUEADO" | "LIMITE_IP" };

const normalizar = (email: string) => email.trim().toLowerCase();

export async function iniciarSessao(
  emailBruto: string,
  password: string,
  meta: MetaPedido = {},
): Promise<ResultadoLogin> {
  const email = normalizar(emailBruto);
  const agora = new Date();

  // Limite por IP (força bruta distribuída por várias contas).
  if (meta.ip) {
    const falhasIp = await db.tentativaLogin.count({
      where: {
        ip: meta.ip,
        sucesso: false,
        em: { gt: new Date(agora.getTime() - AUTH.janelaIpMs) },
      },
    });
    if (falhasIp >= AUTH.maxFalhasIp) {
      await registarAuditoria({
        acao: "LOGIN_BLOQUEADO_IP",
        entidade: "User",
        depois: { identificador: email },
        ip: meta.ip,
      });
      return { ok: false, motivo: "LIMITE_IP" };
    }
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    await gastarTempoDeVerificacao(password);
    await db.tentativaLogin.create({
      data: { identificador: email, ip: meta.ip ?? null, sucesso: false },
    });
    await registarAuditoria({
      acao: "LOGIN_FALHADO",
      entidade: "User",
      depois: { identificador: email, motivo: "desconhecido" },
      ip: meta.ip,
    });
    return { ok: false, motivo: "CREDENCIAIS" };
  }

  if (user.bloqueadoAte && user.bloqueadoAte > agora) {
    await registarAuditoria({
      actorId: user.id,
      acao: "LOGIN_RECUSADO_BLOQUEADO",
      entidade: "User",
      entidadeId: user.id,
      ip: meta.ip,
    });
    return { ok: false, motivo: "BLOQUEADO" };
  }

  const correcta = await verificarPassword(user.passwordHash, password);
  const activo = user.estado === "ACTIVO";

  if (!correcta || !activo) {
    await db.tentativaLogin.create({
      data: { identificador: email, ip: meta.ip ?? null, sucesso: false },
    });
    if (!correcta) {
      const falhas = user.tentativasFalhadas + 1;
      const bloquear = falhas >= AUTH.maxFalhasConta;
      await db.user.update({
        where: { id: user.id },
        data: {
          tentativasFalhadas: bloquear ? 0 : falhas,
          bloqueadoAte: bloquear ? new Date(agora.getTime() + AUTH.bloqueioContaMs) : null,
        },
      });
      await registarAuditoria({
        actorId: user.id,
        acao: "LOGIN_FALHADO",
        entidade: "User",
        entidadeId: user.id,
        depois: { falhas },
        ip: meta.ip,
      });
      if (bloquear) {
        await registarAuditoria({
          actorId: user.id,
          acao: "CONTA_BLOQUEADA_TEMPORARIAMENTE",
          entidade: "User",
          entidadeId: user.id,
          depois: { minutos: AUTH.bloqueioContaMs / 60000 },
          ip: meta.ip,
        });
      }
    } else {
      await registarAuditoria({
        actorId: user.id,
        acao: "LOGIN_RECUSADO_CONTA_INACTIVA",
        entidade: "User",
        entidadeId: user.id,
        depois: { estado: user.estado },
        ip: meta.ip,
      });
    }
    return { ok: false, motivo: "CREDENCIAIS" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { tentativasFalhadas: 0, bloqueadoAte: null, ultimoLogin: agora },
  });
  await db.tentativaLogin.create({
    data: { identificador: email, ip: meta.ip ?? null, sucesso: true },
  });
  const sessao = await criarSessao(user.id, meta);
  await registarAuditoria({
    actorId: user.id,
    acao: "LOGIN_OK",
    entidade: "Session",
    entidadeId: sessao.sessaoId,
    ip: meta.ip,
  });
  return { ok: true, token: sessao.token, expiraEm: sessao.expiraEm, userId: user.id };
}
