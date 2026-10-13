"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { registarAuditoria } from "@/server/audit";
import { areaInicial } from "@/server/authz";
import { COOKIE_SESSAO_NOME, opcoesCookieSessao } from "@/server/auth/config";
import { ipDoPedido, obterUtilizador } from "@/server/auth/dal";
import { iniciarSessao } from "@/server/auth/login";
import { pedirRecuperacao, redefinirPassword } from "@/server/auth/recuperacao";
import { revogarSessaoPorToken } from "@/server/auth/sessao";

export interface EstadoFormulario {
  erro?: string;
  erros?: string[];
  sucesso?: string;
}

const loginSchema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function entrar(
  _: EstadoFormulario | undefined,
  formData: FormData,
): Promise<EstadoFormulario> {
  const dados = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!dados.success) return { erro: "Indique o email e a palavra-passe." };

  const ip = await ipDoPedido();
  const userAgent = (await headers()).get("user-agent");
  const r = await iniciarSessao(dados.data.email, dados.data.password, { ip, userAgent });

  if (!r.ok) {
    if (r.motivo === "BLOQUEADO")
      return {
        erro: "Conta temporariamente bloqueada por tentativas falhadas. Tente mais tarde ou recupere a conta.",
      };
    if (r.motivo === "LIMITE_IP")
      return { erro: "Demasiadas tentativas a partir desta ligação. Tente mais tarde." };
    return { erro: "Email ou palavra-passe incorrectos." };
  }

  (await cookies()).set(COOKIE_SESSAO_NOME, r.token, opcoesCookieSessao(r.expiraEm));
  const user = await obterUtilizador();
  const area = user ? areaInicial(user) : null;
  if (!area) {
    await registarAuditoria({
      actorId: r.userId,
      acao: "LOGIN_SEM_AREA",
      entidade: "User",
      entidadeId: r.userId,
      ip,
    });
    await revogarSessaoPorToken(r.token);
    (await cookies()).delete(COOKIE_SESSAO_NOME);
    return { erro: "A sua conta ainda não tem acesso atribuído. Contacte a secretaria." };
  }
  redirect(`/${area}`);
}

export async function sair(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_SESSAO_NOME)?.value;
  const user = await obterUtilizador();
  await revogarSessaoPorToken(token);
  jar.delete(COOKIE_SESSAO_NOME);
  if (user)
    await registarAuditoria({
      actorId: user.id,
      acao: "LOGOUT",
      entidade: "Session",
      entidadeId: user.sessaoId,
      ip: await ipDoPedido(),
    });
  redirect("/login");
}

export async function recuperar(
  _: EstadoFormulario | undefined,
  formData: FormData,
): Promise<EstadoFormulario> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (email.success) await pedirRecuperacao(email.data, await ipDoPedido());
  // Mesma resposta sempre: não revela se a conta existe.
  return {
    sucesso:
      "Se existir uma conta com esse email, enviámos um link para redefinir a palavra-passe.",
  };
}

export async function redefinir(
  _: EstadoFormulario | undefined,
  formData: FormData,
): Promise<EstadoFormulario> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  if (password !== confirmar) return { erros: ["As palavras-passe não coincidem."] };
  const r = await redefinirPassword(token, password, await ipDoPedido());
  if (!r.ok) return { erros: r.erros };
  redirect("/login?redefinida=1");
}
