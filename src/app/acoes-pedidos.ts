"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Resultado } from "@/components/FormAcao";
import { ipDoPedido, obterUtilizador } from "@/server/auth/dal";
import type { Principal } from "@/server/authz";
import { db } from "@/server/db";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import {
  cancelarPedido,
  decidirPedido,
  emitirDeclaracao,
  pedirDeclaracao,
} from "@/server/modules/declaracoes";

// As permissões e o escopo são verificados pelos serviços (no servidor); aqui só se converte o resultado para o ecrã.
async function correr(
  fn: (u: Principal, ip: string | null) => Promise<string>,
): Promise<Resultado> {
  const user = await obterUtilizador();
  if (!user) redirect("/login");
  try {
    const ok = await fn(user, await ipDoPedido());
    for (const c of ["/estudante/pedidos", "/encarregado/pedidos", "/interno/pedidos"])
      revalidatePath(c);
    return { ok };
  } catch (e) {
    if (e instanceof ErroValidacao) return { erro: e.erros.join(" ") };
    if (e instanceof ErroAutorizacao) return { erro: e.message };
    throw e;
  }
}
const t = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function acaoPedirDeclaracao(_: Resultado | undefined, f: FormData) {
  return correr(async (u, ip) => {
    await pedirDeclaracao(
      u,
      { estudanteId: t(f, "estudanteId"), tipo: t(f, "tipo"), finalidade: t(f, "finalidade") },
      ip,
    );
    return "Pedido enviado. Vai receber um aviso quando houver novidades.";
  });
}

/** Pedido na secretaria: o estudante identifica-se pelo n.º de processo. */
export async function acaoPedirNaSecretaria(_: Resultado | undefined, f: FormData) {
  return correr(async (u, ip) => {
    const e = await db.estudante.findUnique({
      where: { numeroProcesso: t(f, "numeroProcesso").trim() },
      select: { id: true },
    });
    if (!e) throw new ErroValidacao(["Não existe nenhum estudante com esse número de processo."]);
    await pedirDeclaracao(
      u,
      { estudanteId: e.id, tipo: t(f, "tipo"), finalidade: t(f, "finalidade") },
      ip,
    );
    return "Pedido registado.";
  });
}

export async function acaoCancelarPedido(_: Resultado | undefined, f: FormData) {
  return correr(
    async (u, ip) => (await cancelarPedido(u, t(f, "pedidoId"), ip), "Pedido cancelado."),
  );
}
export async function acaoAprovarPedido(_: Resultado | undefined, f: FormData) {
  return correr(
    async (u, ip) => (
      await decidirPedido(u, t(f, "pedidoId"), "APROVAR", t(f, "motivo") || undefined, ip),
      "Pedido aprovado."
    ),
  );
}
export async function acaoRejeitarPedido(_: Resultado | undefined, f: FormData) {
  return correr(
    async (u, ip) => (
      await decidirPedido(u, t(f, "pedidoId"), "REJEITAR", t(f, "motivo"), ip),
      "Pedido rejeitado."
    ),
  );
}
export async function acaoEmitirDeclaracao(_: Resultado | undefined, f: FormData) {
  return correr(
    async (u, ip) => (await emitirDeclaracao(u, t(f, "pedidoId"), ip), "Declaração emitida."),
  );
}
