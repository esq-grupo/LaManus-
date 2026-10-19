import { notFound } from "next/navigation";
import { z } from "zod";
import { PainelEducando } from "@/components/PainelEducando";
import { SeletorEducando } from "@/components/SeletorEducando";
import { exigirArea } from "@/server/auth/dal";
import { educandosDoPortal } from "@/server/modules/pessoas";

export const metadata = { title: "Educando — Lá Manu" };

export default async function Educando({ params }: { params: Promise<{ educandoId: string }> }) {
  const user = await exigirArea("encarregado");
  const { educandoId } = await params;
  const educandos = await educandosDoPortal(user);
  const id = z.string().uuid().safeParse(educandoId);
  // Inexistente, de outra família, sem ligação verificada/activa ou fora da validade: a MESMA resposta (404).
  const e = id.success ? educandos.find((x) => x.id === id.data) : undefined;
  if (!e) notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Os meus educandos</h1>
      <SeletorEducando educandos={educandos} activo={e.id} />
      <div className="space-y-2" data-testid="educando">
        <p className="font-medium">
          {e.nome}{" "}
          <span className="text-sm font-normal text-slate-600">· Processo {e.numeroProcesso}</span>
        </p>
        <PainelEducando user={user} estudanteId={e.id} />
      </div>
    </main>
  );
}
