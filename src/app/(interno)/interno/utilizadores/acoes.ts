"use server";

import { revalidatePath } from "next/cache";
import { ipDoPedido, exigirPermissao, tokenDaSessao } from "@/server/auth/dal";
import { PAPEIS } from "@/server/authz";
import {
  ErroAutorizacao,
  ErroValidacao,
  alterarPapeis,
  criarUtilizador,
  definirEstado,
  reenviarConvite,
  revogarSessoesDe,
} from "@/server/modules/utilizadores";

export interface Resultado {
  erro?: string;
  ok?: string;
}

async function executar(fn: () => Promise<string>): Promise<Resultado> {
  try {
    return { ok: await fn() };
  } catch (e) {
    if (e instanceof ErroValidacao) return { erro: e.erros.join(" ") };
    if (e instanceof ErroAutorizacao) return { erro: e.message };
    throw e;
  }
}

const papeisDe = (f: FormData) =>
  f
    .getAll("papeis")
    .map(String)
    .filter((p) => (PAPEIS as readonly string[]).includes(p));

export async function acaoCriar(_: Resultado | undefined, f: FormData): Promise<Resultado> {
  const actor = await exigirPermissao("utilizadores:gerir");
  const ip = await ipDoPedido();
  const r = await executar(async () => {
    await criarUtilizador(
      actor,
      { nome: f.get("nome"), email: f.get("email"), papeis: papeisDe(f) },
      { tokenSessao: await tokenDaSessao(), ip },
    );
    return "Utilizador criado. Enviámos-lhe um link para definir a palavra-passe.";
  });
  revalidatePath("/interno/utilizadores");
  return r;
}

export async function acaoPapeis(_: Resultado | undefined, f: FormData): Promise<Resultado> {
  const actor = await exigirPermissao("utilizadores:gerir");
  const r = await executar(async () => {
    await alterarPapeis(actor, String(f.get("id")), papeisDe(f), {
      tokenSessao: await tokenDaSessao(),
      ip: await ipDoPedido(),
    });
    return "Papéis actualizados.";
  });
  revalidatePath("/interno/utilizadores");
  return r;
}

export async function acaoEstado(_: Resultado | undefined, f: FormData): Promise<Resultado> {
  const actor = await exigirPermissao("utilizadores:gerir");
  const estado = f.get("estado") === "ACTIVO" ? "ACTIVO" : "DESACTIVADO";
  const r = await executar(async () => {
    await definirEstado(actor, String(f.get("id")), estado, {
      tokenSessao: await tokenDaSessao(),
      ip: await ipDoPedido(),
    });
    return estado === "ACTIVO" ? "Conta reactivada." : "Conta desactivada e sessões terminadas.";
  });
  revalidatePath("/interno/utilizadores");
  return r;
}

export async function acaoRevogar(_: Resultado | undefined, f: FormData): Promise<Resultado> {
  const actor = await exigirPermissao("utilizadores:gerir");
  const r = await executar(async () => {
    const n = await revogarSessoesDe(actor, String(f.get("id")), {
      tokenSessao: await tokenDaSessao(),
      ip: await ipDoPedido(),
    });
    return `${n} sessão(ões) terminada(s).`;
  });
  revalidatePath("/interno/utilizadores");
  return r;
}

export async function acaoConvite(_: Resultado | undefined, f: FormData): Promise<Resultado> {
  const actor = await exigirPermissao("utilizadores:gerir");
  return executar(async () => {
    await reenviarConvite(actor, String(f.get("id")), await ipDoPedido());
    return "Link enviado.";
  });
}
