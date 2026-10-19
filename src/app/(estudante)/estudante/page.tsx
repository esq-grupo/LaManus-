import { PainelEducando } from "@/components/PainelEducando";
import { exigirArea } from "@/server/auth/dal";
import { educandosDoPortal } from "@/server/modules/pessoas";

export const metadata = { title: "Portal do Estudante — Lá Manu" };

export default async function Pagina() {
  const user = await exigirArea("estudante");
  const [eu] = await educandosDoPortal(user);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">O meu perfil</h1>
      {eu ? (
        <>
          <p data-testid="perfil">
            {eu.nome} <span className="text-sm text-slate-600">· Processo {eu.numeroProcesso}</span>
          </p>
          <PainelEducando user={user} estudanteId={eu.id} />
        </>
      ) : (
        <p className="text-slate-600">
          A sua conta ainda não está associada a um estudante. Fale com a secretaria.
        </p>
      )}
    </main>
  );
}
