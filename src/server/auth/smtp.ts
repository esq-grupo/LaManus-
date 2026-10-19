import nodemailer from "nodemailer";
import type { Email, Mailer } from "./mailer";

export interface ConfigSmtp {
  host: string;
  port: number;
  /** TLS desde a ligação (porta 465). Caso contrário exige-se STARTTLS (salvo `semTls`, só fora de produção). */
  seguro: boolean;
  utilizador?: string;
  palavraPasse?: string;
  remetente: string;
  semTls?: boolean;
}

/** Lê a configuração do ambiente; `null` se não houver SMTP configurado. Erro claro se estiver incompleta. */
export function lerConfigSmtp(
  env: Record<string, string | undefined> = process.env,
): ConfigSmtp | null {
  if (!env.SMTP_HOST) return null;
  if (!env.SMTP_REMETENTE) throw new Error("SMTP_HOST definido sem SMTP_REMETENTE.");
  const port = Number(env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT inválida.");
  if (Boolean(env.SMTP_UTILIZADOR) !== Boolean(env.SMTP_PALAVRA_PASSE))
    throw new Error("Defina SMTP_UTILIZADOR e SMTP_PALAVRA_PASSE em conjunto.");
  return {
    host: env.SMTP_HOST,
    port,
    seguro: env.SMTP_SEGURO === "sim" || port === 465,
    utilizador: env.SMTP_UTILIZADOR,
    palavraPasse: env.SMTP_PALAVRA_PASSE,
    remetente: env.SMTP_REMETENTE,
    // Em produção a cifra é sempre obrigatória: esta opção é ignorada.
    semTls: env.NODE_ENV !== "production" && env.SMTP_SEM_TLS === "sim",
  };
}

/**
 * Envia por SMTP. As credenciais e os detalhes técnicos nunca vão para as mensagens de erro nem para os registos
 * (o chamador audita a falha sem detalhes); a falha é uma só mensagem genérica.
 */
export function criarMailerSmtp(c: ConfigSmtp): Mailer {
  const transporte = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.seguro,
    requireTLS: !c.seguro && !c.semTls,
    ignoreTLS: !c.seguro && Boolean(c.semTls),
    auth: c.utilizador ? { user: c.utilizador, pass: c.palavraPasse } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async enviar(email: Email) {
      try {
        await transporte.sendMail({
          from: c.remetente,
          to: email.para,
          subject: email.assunto,
          text: email.texto,
        });
      } catch {
        throw new Error("Falha no envio de email (servidor SMTP).");
      }
    },
  };
}
