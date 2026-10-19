import { ExtractoFinanceiro } from "@/components/ExtractoFinanceiro";
import { QuadroNotas } from "@/components/QuadroNotas";
import type { Principal } from "@/server/authz";
import { extractoDoEstudante } from "@/server/modules/financeiro";
import { notasDoEstudante } from "@/server/modules/notas-leitura";

/**
 * Notas publicadas + contas de UM estudante, para os portais. Os dois serviços verificam o acesso na sessão
 * (próprio / educando verificado e activo); aqui nada é decidido a partir do que vem no URL.
 */
export async function PainelEducando({
  user,
  estudanteId,
}: {
  user: Principal;
  estudanteId: string;
}) {
  const [notas, contas] = await Promise.all([
    notasDoEstudante(user, estudanteId),
    extractoDoEstudante(user, estudanteId),
  ]);
  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-labelledby="h-notas">
        <h2 id="h-notas" className="text-lg font-semibold">
          Notas
        </h2>
        {notas && <QuadroNotas notas={notas} />}
      </section>
      <section className="space-y-2" aria-labelledby="h-contas">
        <h2 id="h-contas" className="text-lg font-semibold">
          Contas
        </h2>
        <ExtractoFinanceiro extracto={contas} />
      </section>
    </div>
  );
}
