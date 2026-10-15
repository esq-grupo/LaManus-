import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/FormAcao";
import { exigirPermissao, ipDoPedido } from "@/server/auth/dal";
import type { Permissao, Principal } from "@/server/authz";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";

export type CorpoAccao = (actor: Principal, ip: string | null) => Promise<string>;

/**
 * Corpo comum das Server Actions: verifica a permissão NO SERVIDOR (e audita a recusa), executa, converte erros de
 * negócio em mensagens para o utilizador e revalida as páginas afectadas.
 */
export async function correrAccao(
  permissao: Permissao,
  fn: CorpoAccao,
  caminhos: string[],
): Promise<Resultado> {
  const actor = await exigirPermissao(permissao);
  const ip = await ipDoPedido();
  try {
    const ok = await fn(actor, ip);
    for (const c of caminhos) revalidatePath(c);
    return { ok };
  } catch (e) {
    if (e instanceof ErroValidacao) return { erro: e.erros.join(" ") };
    if (e instanceof ErroAutorizacao) return { erro: e.message };
    throw e;
  }
}
