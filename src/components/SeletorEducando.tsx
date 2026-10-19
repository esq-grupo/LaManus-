import Link from "next/link";

/** Escolha do educando (encarregado com vários). Só lista os educandos a que o utilizador tem acesso agora. */
export function SeletorEducando({
  educandos,
  activo,
}: {
  educandos: { id: string; nome: string }[];
  activo: string;
}) {
  if (educandos.length < 2) return null;
  return (
    <nav aria-label="Educandos" className="flex flex-wrap gap-2" data-testid="seletor-educando">
      {educandos.map((e) => (
        <Link
          key={e.id}
          href={`/encarregado/${e.id}`}
          aria-current={e.id === activo ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded border px-4 text-sm ${e.id === activo ? "bg-slate-800 text-white" : "bg-white"}`}
        >
          {e.nome}
        </Link>
      ))}
    </nav>
  );
}
