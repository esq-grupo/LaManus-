import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { criarMailerSmtp, lerConfigSmtp } from "./smtp";

export interface Email {
  para: string;
  assunto: string;
  texto: string;
}
export interface Mailer {
  enviar(email: Email): Promise<void>;
}

/**
 * Desenvolvimento: grava o email num ficheiro em `armazenamento/dev-emails/` (ignorado pelo Git,
 * não vai para os logs). Produção: exige SMTP configurado (SMTP_HOST…, ver smtp.ts) — sem ele, falha de forma explícita.
 */
class MailerDev implements Mailer {
  async enviar(email: Email): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email não configurado em produção: defina SMTP_HOST e SMTP_REMETENTE.");
    }
    const pasta = path.join(process.cwd(), "armazenamento", "dev-emails");
    await mkdir(pasta, { recursive: true });
    const nome = `${Date.now()}-${email.para.replace(/[^a-z0-9@.]/gi, "_")}.txt`;
    await writeFile(
      path.join(pasta, nome),
      `Para: ${email.para}\nAssunto: ${email.assunto}\n\n${email.texto}\n`,
    );
  }
}

let substituto: Mailer | null = null;
let smtp: Mailer | null = null;
/** Com SMTP configurado (SMTP_HOST) envia por SMTP; sem ele, desenvolvimento grava em ficheiro e produção recusa. */
export function obterMailer(): Mailer {
  if (substituto) return substituto;
  if (!smtp) {
    const config = lerConfigSmtp();
    if (!config) return new MailerDev();
    smtp = criarMailerSmtp(config);
  }
  return smtp;
}
/** Para testes. */
export function definirMailer(m: Mailer): void {
  substituto = m;
}

export function urlBase(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}
