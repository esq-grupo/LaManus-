import Link from "next/link";

export const metadata = { title: "Sem ligação — Lá Manu" };

// Página pública e estática (a única que a aplicação guarda para uso sem ligação). Não mostra dados de ninguém.
export default function SemLigacao() {
  return (
    <main className="mx-auto max-w-sm space-y-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Sem ligação à internet</h1>
      <p className="text-slate-700">
        Não conseguimos ligar ao servidor da escola. Por segurança, as notas, as contas e os
        documentos só aparecem com ligação. Verifique a sua internet e tente de novo.
      </p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded border px-4">
        Tentar novamente
      </Link>
    </main>
  );
}
