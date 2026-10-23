import type { ReactNode } from "react";

type TabelaProps = {
  ariaLabel: string;
  children?: ReactNode;
};

export function Tabela({ ariaLabel, children }: TabelaProps) {
  return (
    <div
      className="rounded-raio-md border-borda focus-visible:ring-foco w-full overflow-x-auto border focus-visible:ring-4 focus-visible:outline-none"
      role="region"
      tabIndex={0}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
