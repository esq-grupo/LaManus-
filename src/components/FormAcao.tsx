"use client";

import { useId, useState, useTransition } from "react";

export interface Resultado {
  erro?: string;
  ok?: string;
}

/** Formulário genérico ligado a uma Server Action: mostra o resultado (erro/sucesso) e desactiva o botão enquanto envia. */
export function FormAcao({
  acao,
  rotulo,
  children,
  className = "space-y-2",
  botaoClasse = "rounded bg-slate-800 px-3 py-1 text-sm text-white disabled:opacity-50",
}: {
  acao: (estado: Resultado | undefined, dados: FormData) => Promise<Resultado>;
  rotulo: string;
  children?: React.ReactNode;
  className?: string;
  botaoClasse?: string;
}) {
  const [r, setR] = useState<Resultado>();
  const [pendente, iniciar] = useTransition();
  // Não usamos <form action>: o React 19 limpa o formulário após cada envio, mesmo com erro, e o utilizador
  // perderia o que escreveu. Aqui só se limpa quando a operação tem sucesso.
  return (
    <form
      className={className}
      onSubmit={(evento) => {
        evento.preventDefault();
        const formulario = evento.currentTarget;
        iniciar(async () => {
          const resultado = await acao(undefined, new FormData(formulario));
          setR(resultado);
          if (resultado?.ok) formulario.reset();
        });
      }}
    >
      {children}
      <button disabled={pendente} className={botaoClasse}>
        {pendente ? "A guardar…" : rotulo}
      </button>
      {r?.erro && (
        <p role="alert" className="text-sm text-red-700">
          {r.erro}
        </p>
      )}
      {r?.ok && (
        <p role="status" className="text-sm text-green-700">
          {r.ok}
        </p>
      )}
    </form>
  );
}

export function Campo({
  nome,
  rotulo,
  tipo = "text",
  obrigatorio = false,
  placeholder,
  defaultValue,
}: {
  nome: string;
  rotulo: string;
  tipo?: string;
  obrigatorio?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      {rotulo}
      <input
        name={nome}
        type={tipo}
        required={obrigatorio}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded border p-2"
      />
    </label>
  );
}

export function Escolha({
  nome,
  rotulo,
  opcoes,
  vazio,
  semOpcoes,
  obrigatorio = true,
}: {
  nome: string;
  rotulo: string;
  opcoes: { valor: string; texto: string }[];
  vazio?: string;
  semOpcoes?: string;
  obrigatorio?: boolean;
}) {
  const idSemOpcoes = `ajuda-${nome}-${useId().replace(/:/g, "")}`;
  const mostraSemOpcoes = opcoes.length === 0 && semOpcoes !== undefined;

  return (
    <label className="block text-sm">
      {rotulo}
      <select
        name={nome}
        required={obrigatorio}
        aria-describedby={mostraSemOpcoes ? idSemOpcoes : undefined}
        className="mt-1 w-full rounded border bg-white p-2"
      >
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {mostraSemOpcoes && (
        <p id={idSemOpcoes} className="text-sm text-slate-600">
          {semOpcoes}
        </p>
      )}
    </label>
  );
}
