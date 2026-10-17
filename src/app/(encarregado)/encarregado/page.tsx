import { ExtractoFinanceiro } from "@/components/ExtractoFinanceiro";
import { QuadroNotas } from "@/components/QuadroNotas";
import { exigirArea } from "@/server/auth/dal";
import { extractoDoEstudante } from "@/server/modules/financeiro";
import { notasDoEstudante } from "@/server/modules/notas-leitura";
import { meusEducandos } from "@/server/modules/pessoas";

export const metadata = { title: "Portal do Encarregado — Lá Manu" };

// Só aparecem educandos com ligação verificada E autorização activa, e só as notas já PUBLICADAS.
export default async function Pagina() {
  const user = await exigirArea("encarregado");
  const educandos = await meusEducandos(user);
  const notas = await Promise.all(educandos.map((e) => notasDoEstudante(user, e.id)));
  const contas = await Promise.all(educandos.map((e) => extractoDoEstudante(user, e.id)));
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Os meus educandos</h1>
      {educandos.length === 0 ? (
        <p className="text-slate-600">
          Ainda não tem educandos associados. Se acabou de se registar, a secretaria precisa de
          verificar a ligação.
        </p>
      ) : (
        <ul className="space-y-4">
          {educandos.map((e, i) => (
            <li key={e.id} className="space-y-2" data-testid="educando">
              <p className="font-medium">
                {e.nome}{" "}
                <span className="text-sm font-normal text-slate-600">
                  · Processo {e.numeroProcesso}
                </span>
              </p>
              {notas[i] && <QuadroNotas notas={notas[i]} />}
              <h3 className="text-sm font-medium">Contas</h3>
              {contas[i] && <ExtractoFinanceiro extracto={contas[i]} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
