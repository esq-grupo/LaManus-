import { InstalarApp } from "@/components/InstalarApp";
import { PainelEducando } from "@/components/PainelEducando";
import { SeletorEducando } from "@/components/SeletorEducando";
import { exigirArea } from "@/server/auth/dal";
import { educandosDoPortal } from "@/server/modules/pessoas";

export const metadata = { title: "Portal do Encarregado — Lá Manu" };

// Só aparecem educandos com ligação verificada, autorização activa e dentro da validade; só notas já PUBLICADAS.
// Sem educando escolhido mostra o primeiro; com vários há um selector (cada um tem o seu endereço).
export default async function Pagina() {
  const user = await exigirArea("encarregado");
  const educandos = await educandosDoPortal(user);
  const primeiro = educandos[0];
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Os meus educandos</h1>
      <InstalarApp />
      {primeiro ? (
        <>
          <SeletorEducando educandos={educandos} activo={primeiro.id} />
          <div className="space-y-2" data-testid="educando">
            <p className="font-medium">
              {primeiro.nome}{" "}
              <span className="text-sm font-normal text-slate-600">
                · Processo {primeiro.numeroProcesso}
              </span>
            </p>
            <PainelEducando user={user} estudanteId={primeiro.id} />
          </div>
        </>
      ) : (
        <p className="text-slate-600">
          Ainda não tem educandos associados. Se acabou de se registar, a secretaria precisa de
          verificar a ligação.
        </p>
      )}
    </main>
  );
}
