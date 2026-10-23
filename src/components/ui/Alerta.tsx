import type { ReactNode } from "react";

type Tipo = "informacao" | "sucesso" | "aviso" | "erro";

type AlertaProps = {
  tipo?: Tipo;
  children?: ReactNode;
};

const estilos: Record<Tipo, string> = {
  informacao: "bg-informacao text-primaria-texto",
  sucesso: "bg-sucesso text-primaria-texto",
  aviso: "bg-aviso text-primaria-texto",
  erro: "bg-perigo text-primaria-texto",
};

export function Alerta({ tipo = "informacao", children }: AlertaProps) {
  const eErro = tipo === "erro";
  return (
    <div
      className={`rounded-raio-md text-tamanho-sm px-4 py-3 ${estilos[tipo]}`}
      role={eErro ? "alert" : "status"}
      aria-live={eErro ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
