import type { HTMLAttributes } from "react";

type MarcaProps = HTMLAttributes<HTMLDivElement> & {
  nome?: string;
};

export function Marca({ nome = "Lá Manu", className, ...props }: MarcaProps) {
  const classes = ["inline-flex items-center gap-3 font-bold tracking-tight text-texto", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div {...props} className={classes}>
      <span
        aria-hidden="true"
        className="bg-primaria text-primaria-texto shadow-sombra-subtil grid size-11 shrink-0 place-items-center rounded-full text-base font-extrabold"
      >
        LM
      </span>
      <span>{nome}</span>
    </div>
  );
}
