import { ExtractoFinanceiro } from "@/components/ExtractoFinanceiro";
import { QuadroNotas } from "@/components/QuadroNotas";
import { exigirArea } from "@/server/auth/dal";
import { extractoDoEstudante } from "@/server/modules/financeiro";
import { notasDoEstudante } from "@/server/modules/notas-leitura";
import { meusEducandos } from "@/server/modules/pessoas";

export const metadata = { title: "Portal do Estudante — Lá Manu" };

export default async function Pagina() {
  const user = await exigirArea("estudante");
  const [eu] = await meusEducandos(user);
  const notas = eu ? await notasDoEstudante(user, eu.id) : null;
  const contas = eu ? await extractoDoEstudante(user, eu.id) : null;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">O meu perfil</h1>
      {eu ? (
        <>
          <p data-testid="perfil">
            {eu.nome} <span className="text-sm text-slate-600">· Processo {eu.numeroProcesso}</span>
          </p>
          <h2 className="font-medium">As minhas notas</h2>
          {notas && <QuadroNotas notas={notas} />}
          <h2 className="font-medium">As minhas contas</h2>
          {contas && <ExtractoFinanceiro extracto={contas} />}
        </>
      ) : (
        <p className="text-slate-600">
          A sua conta ainda não está associada a um estudante. Fale com a secretaria.
        </p>
      )}
    </main>
  );
}
