import Link from "next/link";

export const metadata = { title: "Sem permissão — Lá Manu" };

export default function AcessoNegado() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-2 text-xl font-semibold">Sem permissão</h1>
      <p className="mb-4 text-slate-600">
        Não tem permissão para aceder a esta página. O pedido ficou registado.
      </p>
      <Link href="/login" className="underline">
        Voltar ao início
      </Link>
    </main>
  );
}
