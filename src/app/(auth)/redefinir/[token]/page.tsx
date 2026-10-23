import { Marca } from "@/components/ui/Marca";
import { FormularioRedefinir } from "@/components/FormularioRedefinir";

export const metadata = { title: "Definir palavra-passe — Lá Manu" };

export default async function Redefinir({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main id="conteudo" className="bg-fundo min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section className="rounded-raio-lg border-borda bg-superficie shadow-sombra-card w-full border p-6 sm:p-10">
          <Marca nome="Lá Manu" />
          <h1 className="text-texto mt-10 text-3xl font-bold tracking-tight">
            Definir palavra-passe
          </h1>
          <p className="text-texto-suave mt-2 leading-relaxed">
            Crie uma nova palavra-passe para voltar a entrar na plataforma.
          </p>
          <div className="mt-8">
            <FormularioRedefinir token={token} />
          </div>
        </section>
      </div>
    </main>
  );
}
