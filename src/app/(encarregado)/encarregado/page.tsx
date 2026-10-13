import { exigirArea } from "@/server/auth/dal";
import { meusEducandos } from "@/server/modules/pessoas";

export const metadata = { title: "Portal do Encarregado — Lá Manu" };

// Só aparecem educandos com ligação verificada E autorização activa (escopo derivado da sessão).
export default async function Pagina() {
  const user = await exigirArea("encarregado");
  const educandos = await meusEducandos(user);
  return (
    <main className="mx-auto max-w-2xl space-y-3 p-6">
      <h1 className="text-xl font-semibold">Os meus educandos</h1>
      {educandos.length === 0 ? (
        <p className="text-slate-600">
          Ainda não tem educandos associados. Se acabou de se registar, a secretaria precisa de
          verificar a ligação.
        </p>
      ) : (
        <ul className="space-y-2">
          {educandos.map((e) => (
            <li key={e.id} className="rounded border bg-white p-3" data-testid="educando">
              {e.nome} <span className="text-sm text-slate-600">· Processo {e.numeroProcesso}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
