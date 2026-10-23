import type { ReactNode } from "react";

type Estado = "neutro" | "sucesso" | "aviso" | "erro";

type EtiquetaProps = {
  estado?: Estado;
  children?: ReactNode;
};

const estados: Record<Estado, string> = {
  neutro: "bg-fundo text-texto",
  sucesso: "bg-sucesso text-primaria-texto",
  aviso: "bg-aviso text-primaria-texto",
  erro: "bg-perigo text-primaria-texto",
};

export function Etiqueta({ estado = "neutro", children }: EtiquetaProps) {
  return (
    <span
      className={`rounded-raio-pill text-tamanho-sm inline-flex items-center px-3 py-1 font-semibold ${estados[estado]}`}
    >
      {children}
    </span>
  );
}
