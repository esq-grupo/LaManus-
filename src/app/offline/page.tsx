import Link from "next/link";
import { Marca } from "@/components/ui/Marca";

export const metadata = { title: "Sem ligação — Lá Manu" };

// Página pública e estática (a única que a aplicação guarda para uso sem ligação). Não mostra dados de ninguém.
export default function SemLigacao() {
  return (
    <main id="conteudo" className="bg-fundo min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section className="rounded-raio-lg border-borda bg-superficie shadow-sombra-card w-full border p-6 text-center sm:p-10">
          <Marca nome="Lá Manu" />
          <h1 className="text-texto mt-10 text-3xl font-bold tracking-tight">
            Sem ligação à internet
          </h1>
          <p className="text-texto-suave mt-3 leading-relaxed">
            Não conseguimos ligar ao servidor da escola. Por segurança, as notas, as contas e os
            documentos só aparecem com ligação. Verifique a sua internet e tente de novo.
          </p>
          <Link
            href="/"
            className="rounded-raio-md bg-primaria text-primaria-texto hover:bg-primaria-escura focus:ring-foco mt-8 inline-flex min-h-12 items-center justify-center px-5 font-semibold transition-colors focus:ring-4 focus:outline-none"
          >
            Tentar novamente
          </Link>
        </section>
      </div>
    </main>
  );
}
