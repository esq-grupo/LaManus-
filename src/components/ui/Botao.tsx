import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "perigo";

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  carregando?: boolean;
  children?: ReactNode;
};

const variantes: Record<Variante, string> = {
  primario: "bg-primaria text-primaria-texto hover:opacity-90",
  secundario: "border border-borda bg-superficie text-texto hover:bg-fundo",
  perigo: "bg-perigo text-primaria-texto hover:opacity-90",
};

export function Botao({
  variante = "primario",
  carregando = false,
  disabled = false,
  className,
  children,
  type = "button",
  ...props
}: BotaoProps) {
  const classes = [
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-raio-md px-4 py-2 font-semibold",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foco",
    "disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition-opacity",
    variantes[variante],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
    >
      {carregando ? "A carregar…" : children}
    </button>
  );
}
