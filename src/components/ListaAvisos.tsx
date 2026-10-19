"use client";

import { useTransition } from "react";
import { formatarData } from "@/lib/datas";

export interface AvisoVista {
  id: string;
  titulo: string;
  corpo: string;
  lidaEm: Date | null;
  createdAt: Date;
  educando: string | null;
}

/** Lista de avisos com «marcar como lido». As acções recebem só o id; o servidor filtra sempre pelo utilizador da sessão. */
export function ListaAvisos({
  avisos,
  marcar,
  marcarTodos,
}: {
  avisos: AvisoVista[];
  marcar: (id: string) => Promise<void>;
  marcarTodos: () => Promise<void>;
}) {
  const [pendente, iniciar] = useTransition();
  const porLer = avisos.filter((a) => !a.lidaEm).length;
  return (
    <div className="space-y-3" data-testid="avisos">
      {porLer > 0 && (
        <button
          className="min-h-11 rounded border px-4 text-sm disabled:opacity-50"
          disabled={pendente}
          onClick={() => iniciar(() => marcarTodos())}
        >
          Marcar todos como lidos ({porLer})
        </button>
      )}
      <ul className="space-y-2">
        {avisos.map((a) => (
          <li
            key={a.id}
            className={`rounded border p-3 text-sm ${a.lidaEm ? "bg-white" : "border-slate-800 bg-amber-50"}`}
            data-testid={a.lidaEm ? "aviso-lido" : "aviso-novo"}
          >
            <p className="font-medium">{a.titulo}</p>
            <p>{a.corpo}</p>
            <p className="text-slate-600">
              {formatarData(a.createdAt)}
              {a.educando ? ` · ${a.educando}` : ""}
            </p>
            {!a.lidaEm && (
              <button
                className="mt-2 min-h-11 rounded border px-4 disabled:opacity-50"
                disabled={pendente}
                onClick={() => iniciar(() => marcar(a.id))}
              >
                Marcar como lido
              </button>
            )}
          </li>
        ))}
        {avisos.length === 0 && <li className="text-sm text-slate-600">Sem avisos.</li>}
      </ul>
    </div>
  );
}
