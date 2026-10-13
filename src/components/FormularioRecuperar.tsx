"use client";

import { useActionState } from "react";
import { recuperar } from "@/app/(auth)/acoes";

export function FormularioRecuperar() {
  const [estado, acao, pendente] = useActionState(recuperar, undefined);
  return (
    <form action={acao} className="space-y-3">
      <label className="block text-sm">
        Email da conta
        <input name="email" type="email" required className="mt-1 w-full rounded border p-2" />
      </label>
      {estado?.sucesso && (
        <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">
          {estado.sucesso}
        </p>
      )}
      <button
        disabled={pendente}
        className="w-full rounded bg-slate-800 p-2 text-white disabled:opacity-50"
      >
        Enviar link
      </button>
    </form>
  );
}
