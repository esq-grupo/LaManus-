import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { AUTH } from "./config";
import { obterMailer, urlBase } from "./mailer";
import { hashPassword, validarPoliticaPassword } from "./password";
import { revogarSessoesDoUtilizador } from "./sessao";
import { gerarToken, hashToken } from "./tokens";

/** Cria um token de redefinição (uso único, 30 min) e envia o link por email. */
export async function enviarLinkDeRedefinicao(
  userId: string,
  motivo: "RECUPERACAO" | "CONVITE",
  actorId: string | null,
  ip?: string | null,
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.estado === "DESACTIVADO") return;
  // Invalida pedidos anteriores ainda por usar.
  await db.passwordReset.updateMany({
    where: { userId, usadoEm: null },
    data: { usadoEm: new Date() },
  });
  const { token, tokenHash } = gerarToken();
  await db.passwordReset.create({
    data: { userId, tokenHash, expiraEm: new Date(Date.now() + AUTH.resetValidadeMs) },
  });
  const link = `${urlBase()}/redefinir/${token}`;
  const texto =
    motivo === "CONVITE"
      ? `Foi criada uma conta para si na plataforma do Complexo Escolar Lá Manu.\nDefina a sua palavra-passe (o link vale 30 minutos):\n${link}\n`
      : `Pediu para redefinir a palavra-passe.\nUse este link (vale 30 minutos e só pode ser usado uma vez):\n${link}\nSe não pediu, ignore esta mensagem.\n`;
  await obterMailer().enviar({
    para: user.email,
    assunto: motivo === "CONVITE" ? "Conta criada — Lá Manu" : "Redefinir palavra-passe — Lá Manu",
    texto,
  });
  await registarAuditoria({
    actorId,
    acao: motivo === "CONVITE" ? "CONVITE_ENVIADO" : "RECUPERACAO_PEDIDA",
    entidade: "User",
    entidadeId: userId,
    ip,
  });
}

/**
 * Resposta SEMPRE igual, exista ou não a conta e funcione ou não o envio do email: esta função nunca lança.
 * Uma falha (SMTP em baixo, BD) fica auditada sem detalhes técnicos (podem conter segredos) e o utilizador
 * recebe a mesma mensagem — assim a resposta não revela se a conta existe.
 */
export async function pedirRecuperacao(emailBruto: string, ip?: string | null): Promise<void> {
  let userId: string | undefined;
  try {
    const user = await db.user.findUnique({ where: { email: emailBruto.trim().toLowerCase() } });
    if (!user || user.estado === "DESACTIVADO") {
      await registarAuditoria({ acao: "RECUPERACAO_PEDIDA_DESCONHECIDA", entidade: "User", ip });
      return;
    }
    userId = user.id;
    await enviarLinkDeRedefinicao(user.id, "RECUPERACAO", null, ip);
  } catch {
    try {
      await registarAuditoria({
        actorId: userId ?? null,
        acao: "RECUPERACAO_EMAIL_FALHOU",
        entidade: "User",
        entidadeId: userId ?? null,
        ip,
      });
    } catch {
      // Nem a auditoria funcionou: nada mais a fazer sem alterar a resposta.
    }
  }
}

export type ResultadoRedefinicao = { ok: true } | { ok: false; erros: string[] };

export async function redefinirPassword(
  token: string,
  novaPassword: string,
  ip?: string | null,
): Promise<ResultadoRedefinicao> {
  const reset = await db.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (
    !reset ||
    reset.usadoEm ||
    reset.expiraEm <= new Date() ||
    reset.user.estado === "DESACTIVADO"
  ) {
    return { ok: false, erros: ["Este link é inválido ou já expirou. Peça um novo."] };
  }
  const erros = validarPoliticaPassword(novaPassword, {
    email: reset.user.email,
    nome: reset.user.nome,
  });
  if (erros.length > 0) return { ok: false, erros };

  const passwordHash = await hashPassword(novaPassword);
  // Marca como usado de forma atómica: se dois pedidos chegarem juntos, só um passa.
  const marcado = await db.passwordReset.updateMany({
    where: { id: reset.id, usadoEm: null },
    data: { usadoEm: new Date() },
  });
  if (marcado.count === 0) return { ok: false, erros: ["Este link já foi usado."] };

  await db.user.update({
    where: { id: reset.userId },
    data: { passwordHash, tentativasFalhadas: 0, bloqueadoAte: null },
  });
  await revogarSessoesDoUtilizador(reset.userId, reset.userId, "redefinição de palavra-passe", ip);
  await registarAuditoria({
    actorId: reset.userId,
    acao: "PASSWORD_REDEFINIDA",
    entidade: "User",
    entidadeId: reset.userId,
    ip,
  });
  return { ok: true };
}
