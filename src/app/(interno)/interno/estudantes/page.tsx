import Link from "next/link";
import { Campo, FormAcao } from "@/components/FormAcao";
import { exigirPermissao } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { pesquisarEstudantes } from "@/server/modules/pessoas";
import { acaoEstudante } from "../acoes";

export const metadata = { title: "Estudantes — Lá Manu" };

export default async function Estudantes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await exigirPermissao("estudantes:ver");
  const { q = "" } = await searchParams;
  const lista = await pesquisarEstudantes(actor, q);
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Estudantes</h1>
      <form className="flex gap-2" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Nome, n.º de processo ou BI"
          aria-label="Pesquisar estudantes"
          className="w-full rounded border p-2"
        />
        <button className="rounded bg-slate-800 px-3 text-white">Pesquisar</button>
      </form>
      <ul className="space-y-2">
        {lista.map((e) => (
          <li key={e.id} className="rounded border bg-white p-3">
            <Link href={`/interno/estudantes/${e.id}`} className="font-medium underline">
              {e.nome}
            </Link>{" "}
            <span className="text-sm text-slate-600">
              · Processo {e.numeroProcesso}
              {e.bi ? ` · BI ${e.bi}` : ""} · {e.estado}
              {e.turmas.length ? ` · ${e.turmas.join(", ")}` : " · sem matrícula activa"}
            </span>
          </li>
        ))}
        {lista.length === 0 && (
          <li className="text-sm text-slate-600">Nenhum estudante encontrado.</li>
        )}
      </ul>
      {can(actor, "estudantes:editar") && (
        <FormAcao
          acao={acaoEstudante}
          rotulo="Criar estudante"
          className="space-y-2 rounded border bg-white p-3"
        >
          <h2 className="font-medium">Novo estudante</h2>
          <Campo nome="numeroProcesso" rotulo="N.º de processo" obrigatorio />
          <Campo nome="nome" rotulo="Nome completo" obrigatorio />
          <Campo nome="dataNascimento" rotulo="Data de nascimento" tipo="date" obrigatorio />
          <Campo nome="bi" rotulo="BI / cédula (opcional)" />
          <Campo nome="contacto" rotulo="Contacto (opcional)" />
        </FormAcao>
      )}
    </main>
  );
}
