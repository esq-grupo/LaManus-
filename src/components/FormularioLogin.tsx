"use client";

import { useActionState } from "react";
import Link from "next/link";
import { entrar } from "@/app/(auth)/acoes";

export function FormularioLogin({ aviso }: { aviso?: string }) {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="grid gap-4">
      {aviso && (
        <p
          role="status"
          className="rounded-raio-md bg-sucesso text-primaria-texto px-3 py-3 text-sm"
        >
          {aviso}
        </p>
      )}
      <label className="text-texto grid gap-2 text-sm font-semibold">
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-raio-md border-borda-controlo bg-superficie text-texto shadow-sombra-subtil focus:ring-foco min-h-12 w-full border px-3 focus:ring-4 focus:outline-none"
        />
      </label>
      <label className="text-texto grid gap-2 text-sm font-semibold">
        <span>Palavra-passe</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-raio-md border-borda-controlo bg-superficie text-texto shadow-sombra-subtil focus:ring-foco min-h-12 w-full border px-3 focus:ring-4 focus:outline-none"
        />
      </label>
      {estado?.erro && (
        <p role="alert" className="rounded-raio-md bg-perigo text-primaria-texto px-3 py-3 text-sm">
          {estado.erro}
        </p>
      )}
      <button
        disabled={pendente}
        className="rounded-raio-md bg-primaria text-primaria-texto shadow-sombra-subtil hover:bg-primaria-escura focus:ring-foco min-h-12 w-full px-4 font-semibold transition-colors focus:ring-4 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pendente ? "A entrar…" : "Entrar"}
      </button>
      <p className="text-texto-suave text-center text-sm">
        <Link
          href="/recuperar"
          className="text-primaria-escura inline-flex min-h-11 items-center px-2 font-semibold underline-offset-4 hover:underline"
        >
          Esqueci-me da palavra-passe
        </Link>
      </p>
    </form>
  );
}
