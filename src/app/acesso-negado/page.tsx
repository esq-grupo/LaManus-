import Link from "next/link";
import { Marca } from "@/components/ui/Marca";

export const metadata = { title: "Sem permissão — Lá Manu" };

export default function AcessoNegado() {
  return (
    <main id="conteudo" className="bg-fundo min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <section className="rounded-raio-lg border-borda bg-superficie shadow-sombra-card w-full border p-6 sm:p-10">
          <Marca nome="Lá Manu" />
          <p className="text-acento mt-10 text-xs font-extrabold tracking-[0.14em] uppercase">
            Acesso reservado
          </p>
          <h1 className="text-texto mt-3 text-3xl font-bold tracking-tight">Sem permissão</h1>
          <p className="text-texto-suave mt-3 leading-relaxed">
            Não tem permissão para aceder a esta página. O pedido ficou registado.
          </p>
          <Link
            href="/login"
            className="rounded-raio-md bg-primaria text-primaria-texto hover:bg-primaria-escura focus:ring-foco mt-8 inline-flex min-h-12 items-center justify-center px-5 font-semibold transition-colors focus:ring-4 focus:outline-none"
          >
            Voltar ao início
          </Link>
        </section>
      </div>
    </main>
  );
}
