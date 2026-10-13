import Link from "next/link";
import { sair } from "@/app/(auth)/acoes";

export function CabecalhoArea({
  titulo,
  nome,
  links = [],
}: {
  titulo: string;
  nome: string;
  links?: { href: string; texto: string }[];
}) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 p-3">
        <strong>{titulo}</strong>
        <nav className="flex gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="underline">
              {l.texto}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-sm text-slate-600">{nome}</span>
        <form action={sair}>
          <button className="rounded border px-2 py-1 text-sm">Sair</button>
        </form>
      </div>
    </header>
  );
}
