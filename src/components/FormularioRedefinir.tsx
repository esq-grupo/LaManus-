"use client";

import { useActionState } from "react";
import { redefinir } from "@/app/(auth)/acoes";

export function FormularioRedefinir({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState(redefinir, undefined);
  return (
    <form action={acao} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="text-texto grid gap-2 text-sm font-semibold">
        <span>Nova palavra-passe (mínimo 10 caracteres)</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="rounded-raio-md border-borda-controlo bg-superficie text-texto shadow-sombra-subtil focus:ring-foco min-h-12 w-full border px-3 focus:ring-4 focus:outline-none"
        />
      </label>
      <label className="text-texto grid gap-2 text-sm font-semibold">
        <span>Repita a palavra-passe</span>
        <input
          name="confirmar"
          type="password"
          autoComplete="new-password"
          required
          className="rounded-raio-md border-borda-controlo bg-superficie text-texto shadow-sombra-subtil focus:ring-foco min-h-12 w-full border px-3 focus:ring-4 focus:outline-none"
        />
      </label>
      {estado?.erros && (
        <ul
          role="alert"
          className="rounded-raio-md bg-perigo text-primaria-texto list-disc px-3 py-3 pl-8 text-sm"
        >
          {estado.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button
        disabled={pendente}
        className="rounded-raio-md bg-primaria text-primaria-texto shadow-sombra-subtil hover:bg-primaria-escura focus:ring-foco min-h-12 w-full px-4 font-semibold transition-colors focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}
