import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { registarAuditoria } from "@/server/audit";
import { areaInicial, can, podeAceder, type Area, type Permissao } from "@/server/authz";
import { COOKIE_SESSAO_NOME } from "./config";
import { validarSessao, type UtilizadorSessao } from "./sessao";

/** Sessão do pedido actual (validada na BD; memoizada por pedido). */
export const obterUtilizador = cache(async (): Promise<UtilizadorSessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO_NOME)?.value;
  return validarSessao(token);
});

export async function ipDoPedido(): Promise<string | null> {
  const h = await headers();
  // Atrás do proxy reverso da escola (Caddy/Nginx) o primeiro valor é o cliente.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Exige sessão válida e acesso à área; senão audita e redirecciona. */
export async function exigirArea(area: Area): Promise<UtilizadorSessao> {
  const user = await obterUtilizador();
  if (!user) redirect("/login");
  if (!podeAceder(user, area)) {
    await registarAuditoria({
      actorId: user.id,
      acao: "ACESSO_NEGADO",
      entidade: "Area",
      entidadeId: area,
      ip: await ipDoPedido(),
    });
    const destino = areaInicial(user);
    redirect(destino ? `/acesso-negado?de=${area}` : "/login");
  }
  return user;
}

/** Exige uma permissão concreta (para páginas e Server Actions). */
export async function exigirPermissao(permissao: Permissao): Promise<UtilizadorSessao> {
  const user = await obterUtilizador();
  if (!user) redirect("/login");
  if (!can(user, permissao)) {
    await registarAuditoria({
      actorId: user.id,
      acao: "ACESSO_NEGADO",
      entidade: "Permissao",
      entidadeId: permissao,
      ip: await ipDoPedido(),
    });
    redirect("/acesso-negado");
  }
  return user;
}
