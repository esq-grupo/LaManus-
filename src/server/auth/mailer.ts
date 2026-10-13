import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
 * não vai para os logs). Produção: exige configuração SMTP (D11) — sem ela, falha de forma explícita.
 */
class MailerDev implements Mailer {
  async enviar(email: Email): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email não configurado em produção (D11): defina o transporte SMTP.");
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

let mailer: Mailer = new MailerDev();
export const obterMailer = (): Mailer => mailer;
/** Para testes. */
export function definirMailer(m: Mailer): void {
  mailer = m;
}

export function urlBase(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}
