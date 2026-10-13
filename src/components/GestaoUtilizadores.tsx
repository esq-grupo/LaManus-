"use client";

import { useActionState } from "react";
import { NOMES_PAPEIS, PAPEIS, type Papel } from "@/server/authz/permissoes";
import {
  acaoConvite,
  acaoCriar,
  acaoEstado,
  acaoPapeis,
  acaoRevogar,
} from "@/app/(interno)/interno/utilizadores/acoes";

export interface LinhaUtilizador {
  id: string;
  nome: string;
  email: string;
  estado: string;
  papeis: Papel[];
}

function Msg({ r }: { r?: { erro?: string; ok?: string } }) {
  if (r?.erro)
    return (
      <p role="alert" className="text-sm text-red-700">
        {r.erro}
      </p>
    );
  if (r?.ok)
    return (
      <p role="status" className="text-sm text-green-700">
        {r.ok}
      </p>
    );
  return null;
}

function Papeis({ seleccionados = [] as Papel[] }) {
  return (
    <fieldset className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
      {PAPEIS.map((p) => (
        <label key={p} className="flex items-center gap-1">
          <input
            type="checkbox"
            name="papeis"
            value={p}
            defaultChecked={seleccionados.includes(p)}
          />
          {NOMES_PAPEIS[p]}
        </label>
      ))}
    </fieldset>
  );
}

export function NovoUtilizador() {
  const [r, acao, pendente] = useActionState(acaoCriar, undefined);
  return (
    <form action={acao} className="space-y-2 rounded border bg-white p-3">
      <h2 className="font-medium">Novo utilizador</h2>
      <input name="nome" placeholder="Nome" required className="w-full rounded border p-2" />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full rounded border p-2"
      />
      <Papeis />
      <Msg r={r} />
      <button
        disabled={pendente}
        className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50"
      >
        Criar e enviar convite
      </button>
    </form>
  );
}

export function LinhaUtilizadorForm({ u, euProprio }: { u: LinhaUtilizador; euProprio: boolean }) {
  const [rp, ap] = useActionState(acaoPapeis, undefined);
  const [re, ae] = useActionState(acaoEstado, undefined);
  const [rr, ar] = useActionState(acaoRevogar, undefined);
  const [rc, ac] = useActionState(acaoConvite, undefined);
  return (
    <li className="space-y-2 rounded border bg-white p-3" data-testid={`utilizador-${u.email}`}>
      <div>
        <strong>{u.nome}</strong> <span className="text-sm text-slate-600">{u.email}</span>{" "}
        <span className="rounded bg-slate-100 px-1 text-xs">{u.estado}</span>
        {euProprio && <span className="ml-2 text-xs">(a sua conta)</span>}
      </div>
      <form action={ap} className="space-y-1">
        <input type="hidden" name="id" value={u.id} />
        <Papeis seleccionados={u.papeis} />
        <button
          disabled={euProprio}
          className="rounded border px-2 py-1 text-sm disabled:opacity-40"
        >
          Guardar papéis
        </button>
        <Msg r={rp} />
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={ae}>
          <input type="hidden" name="id" value={u.id} />
          <input
            type="hidden"
            name="estado"
            value={u.estado === "ACTIVO" ? "DESACTIVADO" : "ACTIVO"}
          />
          <button
            disabled={euProprio}
            className="rounded border px-2 py-1 text-sm disabled:opacity-40"
          >
            {u.estado === "ACTIVO" ? "Desactivar" : "Reactivar"}
          </button>
        </form>
        <form action={ar}>
          <input type="hidden" name="id" value={u.id} />
          <button className="rounded border px-2 py-1 text-sm">Terminar sessões</button>
        </form>
        <form action={ac}>
          <input type="hidden" name="id" value={u.id} />
          <button className="rounded border px-2 py-1 text-sm">Reenviar link</button>
        </form>
      </div>
      <Msg r={re ?? rr ?? rc} />
    </li>
  );
}
