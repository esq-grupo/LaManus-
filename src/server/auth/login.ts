import { dbAuth as db } from "@/server/db-auth";
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

  // Bloqueio expirado: o contador recomeça (idempotente, seguro com pedidos simultâneos).
  if (user.bloqueadoAte) {
    await db.user.updateMany({
      where: { id: user.id, bloqueadoAte: { lte: agora } },
      data: { tentativasFalhadas: 0, bloqueadoAte: null },
    });
  }

  // RESERVA ATÓMICA da tentativa, ANTES de verificar a palavra-passe.
  // `increment` é um único UPDATE ... SET n = n + 1 na BD: com pedidos simultâneos cada um recebe um número
  // distinto, por isso no máximo `maxFalhasConta` palavras-passe são verificadas por janela, mesmo numa rajada.
  const { tentativasFalhadas: reservada } = await db.user.update({
    where: { id: user.id },
    data: { tentativasFalhadas: { increment: 1 } },
    select: { tentativasFalhadas: true },
  });
  const fimDoBloqueio = () => new Date(Date.now() + AUTH.bloqueioContaMs);

  if (reservada > AUTH.maxFalhasConta) {
    await db.user.updateMany({
      where: { id: user.id, bloqueadoAte: null },
      data: { bloqueadoAte: fimDoBloqueio() },
    });
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
      const bloquear = reservada >= AUTH.maxFalhasConta;
      if (bloquear) {
        await db.user.update({ where: { id: user.id }, data: { bloqueadoAte: fimDoBloqueio() } });
      }
      await registarAuditoria({
        actorId: user.id,
        acao: "LOGIN_FALHADO",
        entidade: "User",
        entidadeId: user.id,
        depois: { falhas: reservada },
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
