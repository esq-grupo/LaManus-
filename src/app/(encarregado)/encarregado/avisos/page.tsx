import { acaoMarcarLido, acaoMarcarTodosLidos } from "@/app/acoes-avisos";
import { ListaAvisos } from "@/components/ListaAvisos";
import { exigirArea } from "@/server/auth/dal";
import { listarAvisos } from "@/server/modules/notificacoes";

export const metadata = { title: "Avisos — Lá Manu" };

export default async function Avisos() {
  const user = await exigirArea("encarregado");
  const avisos = await listarAvisos(user);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Avisos</h1>
      <ListaAvisos
        avisos={avisos.map((a) => ({ ...a, educando: a.estudante?.nome ?? null }))}
        marcar={acaoMarcarLido}
        marcarTodos={acaoMarcarTodosLidos}
      />
    </main>
  );
}
