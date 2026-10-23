import { Marca } from "@/components/ui/Marca";
import { FormularioLogin } from "@/components/FormularioLogin";

export const metadata = { title: "Entrar — Lá Manu" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ redefinida?: string }>;
}) {
  const { redefinida } = await searchParams;
  return (
    <main id="conteudo" className="bg-fundo min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,.92fr)]">
        <section className="hidden flex-col justify-center px-4 py-8 lg:flex lg:px-12">
          <Marca nome="Lá Manu — Escola de Enfermagem" />
          <p className="text-primaria-escura mt-16 text-xs font-extrabold tracking-[0.14em] uppercase">
            Cuidar começa com organização
          </p>
          <p className="text-texto mt-4 max-w-xl text-5xl leading-[1.02] font-bold tracking-[-0.055em]">
            Uma só plataforma para acompanhar cada percurso.
          </p>
          <p className="text-texto-suave mt-5 max-w-lg text-lg leading-relaxed">
            Estrutura escolar, estudantes, avaliações e comunicação num espaço simples, seguro e
            feito para o ritmo da escola.
          </p>
          <p className="text-texto-suave mt-12 flex items-center gap-3 text-sm">
            <span
              aria-hidden="true"
              className="bg-acento ring-acento/10 size-3 rounded-full ring-4"
            />
            Ambiente reservado à comunidade escolar
          </p>
        </section>
        <section className="flex items-center justify-center py-4 lg:py-8">
          <div className="rounded-raio-lg border-borda bg-superficie shadow-sombra-card lg:shadow-sombra-subtil w-full max-w-md border p-6 sm:p-10">
            <Marca nome="Lá Manu" />
            <h1 className="text-texto mt-10 text-3xl font-bold tracking-tight">Entrar</h1>
            <p className="text-texto-suave mt-2 leading-relaxed">
              Entre com a sua conta para continuar a acompanhar o dia-a-dia da escola.
            </p>
            <div className="mt-8">
              <FormularioLogin
                aviso={redefinida ? "Palavra-passe redefinida. Já pode entrar." : undefined}
              />
            </div>
            <p className="border-borda text-texto-suave mt-8 border-t pt-5 text-center text-xs">
              Se precisar de ajuda, contacte a secretaria da escola.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
