import Link from "next/link";
import { sair } from "@/app/(auth)/acoes";

/** Cabeçalho dos portais: alvos de toque grandes, funciona em ecrãs estreitos (quebra de linha em vez de rolar). */
export function NavPortal({
  titulo,
  nome,
  base,
  porLer,
}: {
  titulo: string;
  nome: string;
  base: string;
  porLer: number;
}) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1 p-3">
        <strong className="text-base">{titulo}</strong>
        <span className="ml-auto text-sm text-slate-600">{nome}</span>
        <nav aria-label="Principal" className="flex w-full flex-wrap items-center gap-2 text-sm">
          <Link href={base} className="inline-flex min-h-11 items-center rounded border px-4">
            Início
          </Link>
          <Link
            href={`${base}/pedidos`}
            className="inline-flex min-h-11 items-center rounded border px-4"
          >
            Pedidos
          </Link>
          <Link
            href={`${base}/avisos`}
            className="inline-flex min-h-11 items-center gap-2 rounded border px-4"
            data-testid="nav-avisos"
          >
            Avisos
            {porLer > 0 && (
              <span
                className="rounded-full bg-slate-800 px-2 text-xs text-white"
                data-testid="avisos-por-ler"
              >
                {porLer}
              </span>
            )}
          </Link>
          <form action={sair} className="ml-auto">
            <button className="min-h-11 rounded border px-4">Sair</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
