"use client";

import { useActionState } from "react";
import { recuperar } from "@/app/(auth)/acoes";

export function FormularioRecuperar() {
  const [estado, acao, pendente] = useActionState(recuperar, undefined);
  return (
    <form action={acao} className="grid gap-4">
      <label className="text-texto grid gap-2 text-sm font-semibold">
        <span>Email da conta</span>
        <input
          name="email"
          type="email"
          required
          className="rounded-raio-md border-borda-controlo bg-superficie text-texto shadow-sombra-subtil focus:ring-foco min-h-12 w-full border px-3 focus:ring-4 focus:outline-none"
        />
      </label>
      {estado?.sucesso && (
        <p
          role="status"
          className="rounded-raio-md bg-sucesso text-primaria-texto px-3 py-3 text-sm"
        >
          {estado.sucesso}
        </p>
      )}
      <button
        disabled={pendente}
        className="rounded-raio-md bg-primaria text-primaria-texto shadow-sombra-subtil hover:bg-primaria-escura focus:ring-foco min-h-12 w-full px-4 font-semibold transition-colors focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        Enviar link
      </button>
    </form>
  );
}
