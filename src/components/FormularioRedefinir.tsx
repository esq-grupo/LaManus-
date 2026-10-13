"use client";

import { useActionState } from "react";
import { redefinir } from "@/app/(auth)/acoes";

export function FormularioRedefinir({ token }: { token: string }) {
  const [estado, acao, pendente] = useActionState(redefinir, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm">
        Nova palavra-passe (mínimo 10 caracteres)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="block text-sm">
        Repita a palavra-passe
        <input
          name="confirmar"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      {estado?.erros && (
        <ul role="alert" className="list-disc rounded bg-red-50 p-2 pl-6 text-sm text-red-800">
          {estado.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button
        disabled={pendente}
        className="w-full rounded bg-slate-800 p-2 text-white disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}
