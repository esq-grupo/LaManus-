import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id?: string;
  rotulo: ReactNode;
  ajuda?: ReactNode;
  erro?: ReactNode;
};

export function Campo({ id, rotulo, ajuda, erro, className, ...props }: CampoProps) {
  const reactId = useId();
  const campoId = id ?? `campo-${reactId.replaceAll(":", "")}`;
  const ajudaId = `${campoId}-ajuda`;
  const erroId = `${campoId}-erro`;
  const describedBy =
    [ajuda ? ajudaId : null, erro ? erroId : null].filter(Boolean).join(" ") || undefined;
  const inputClasses = [
    "min-h-11 w-full rounded-raio-md border border-borda-controlo bg-superficie px-3 py-2 text-texto shadow-sombra-subtil",
    "placeholder:text-texto-suave focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foco",
    erro ? "border-perigo" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <label htmlFor={campoId} className="text-tamanho-sm text-texto grid gap-1 font-semibold">
        <span>{rotulo}</span>
        <input
          {...props}
          id={campoId}
          className={inputClasses}
          aria-describedby={describedBy}
          aria-invalid={erro ? true : undefined}
        />
      </label>
      {ajuda ? (
        <span id={ajudaId} className="text-tamanho-sm text-texto-suave">
          {ajuda}
        </span>
      ) : null}
      {erro ? (
        <span id={erroId} className="text-tamanho-sm text-perigo font-medium">
          {erro}
        </span>
      ) : null}
    </div>
  );
}
