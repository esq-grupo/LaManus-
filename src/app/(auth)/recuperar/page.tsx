import { Marca } from "@/components/ui/Marca";
import { FormularioRecuperar } from "@/components/FormularioRecuperar";

export const metadata = { title: "Recuperar conta — Lá Manu" };

export default function Recuperar() {
  return (
    <main id="conteudo" className="bg-fundo min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section className="rounded-raio-lg border-borda bg-superficie shadow-sombra-card w-full border p-6 sm:p-10">
          <Marca nome="Lá Manu" />
          <h1 className="text-texto mt-10 text-3xl font-bold tracking-tight">Recuperar conta</h1>
          <p className="text-texto-suave mt-2 leading-relaxed">
            Indique o email da conta e enviaremos instruções para recuperar o acesso.
          </p>
          <div className="mt-8">
            <FormularioRecuperar />
          </div>
        </section>
      </div>
    </main>
  );
}
