import type { HTMLAttributes, ReactNode } from "react";

type CartaoProps = HTMLAttributes<HTMLElement> & {
  titulo?: ReactNode;
  children?: ReactNode;
};

export function Cartao({ titulo, children, className, ...props }: CartaoProps) {
  const classes = [
    "rounded-raio-lg border border-borda bg-superficie p-6 shadow-sombra-subtil",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section {...props} className={classes}>
      {titulo ? <h2 className="text-tamanho-lg text-texto mb-4 font-semibold">{titulo}</h2> : null}
      {children}
    </section>
  );
}
