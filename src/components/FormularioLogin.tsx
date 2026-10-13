"use client";

import { useActionState } from "react";
import Link from "next/link";
import { entrar } from "@/app/(auth)/acoes";

export function FormularioLogin({ aviso }: { aviso?: string }) {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="space-y-3">
      {aviso && (
        <p role="status" className="rounded bg-green-50 p-2 text-sm text-green-800">
          {aviso}
        </p>
      )}
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      <label className="block text-sm">
        Palavra-passe
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded border p-2"
        />
      </label>
      {estado?.erro && (
        <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">
          {estado.erro}
        </p>
      )}
      <button
        disabled={pendente}
        className="w-full rounded bg-slate-800 p-2 text-white disabled:opacity-50"
      >
        {pendente ? "A entrar…" : "Entrar"}
      </button>
      <p className="text-sm">
        <Link href="/recuperar" className="underline">
          Esqueci-me da palavra-passe
        </Link>
      </p>
    </form>
  );
}
