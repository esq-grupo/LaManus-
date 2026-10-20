import Link from "next/link";
import { exigirArea } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { veFinanceiroCompleto } from "@/server/authz/scope";

export const metadata = { title: "Área interna — Lá Manu" };

// Atalhos só para o que a pessoa pode usar (a verificação autoritativa continua em cada página, no servidor).
export default async function Pagina() {
  const user = await exigirArea("interno");
  const atalhos = [
    can(user, "estrutura:ver") && {
      href: "/interno/estrutura",
      texto: "Estrutura escolar",
      info: "Anos lectivos, períodos, classes, disciplinas e turmas.",
    },
    can(user, "estudantes:ver") && {
      href: "/interno/estudantes",
      texto: "Estudantes",
      info: "Fichas, encarregados e matrículas.",
    },
    can(user, "notas:lancar") && {
      href: "/interno/notas",
      texto: "Notas",
      info: "Lançar notas das suas disciplinas.",
    },
    can(user, "notas:ver") && {
      href: "/interno/pautas",
      texto: "Pautas",
      info: "Estado, validação e publicação das pautas.",
    },
    veFinanceiroCompleto(user) && {
      href: "/interno/financeiro",
      texto: "Financeiro",
      info: "Encargos, pagamentos, recibos e estornos.",
    },
    (can(user, "declaracoes:aprovar") || can(user, "declaracoes:emitir")) && {
      href: "/interno/pedidos",
      texto: "Pedidos",
      info: "Declarações pedidas: aprovar e emitir.",
    },
    can(user, "utilizadores:ver") && {
      href: "/interno/utilizadores",
      texto: "Utilizadores",
      info: "Contas, papéis e convites.",
    },
  ].filter((a): a is { href: string; texto: string; info: string } => Boolean(a));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold">Olá, {user.nome}</h1>
      <p className="mb-4 text-slate-600">O que pode fazer com a sua conta:</p>
      {atalhos.length === 0 ? (
        <p className="text-slate-600">
          Esta conta ainda não tem acesso a nenhuma área. Fale com a Administração.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {atalhos.map((a) => (
            <li key={a.href} className="rounded border border-slate-300 bg-white p-4">
              <Link href={a.href} className="font-medium underline">
                {a.texto}
              </Link>
              <p className="text-sm text-slate-600">{a.info}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
