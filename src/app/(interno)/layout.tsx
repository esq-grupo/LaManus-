import { CabecalhoArea } from "@/components/CabecalhoArea";
import { exigirArea } from "@/server/auth/dal";
import { can } from "@/server/authz";
import { veFinanceiroCompleto } from "@/server/authz/scope";

// A verificação autoritativa acontece aqui (servidor, BD), não no proxy.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await exigirArea("interno");
  return (
    <>
      <CabecalhoArea
        titulo="Área interna"
        nome={user.nome}
        links={[
          { href: "/interno", texto: "Início" },
          ...(can(user, "estrutura:ver")
            ? [{ href: "/interno/estrutura", texto: "Estrutura" }]
            : []),
          ...(can(user, "estudantes:ver")
            ? [{ href: "/interno/estudantes", texto: "Estudantes" }]
            : []),
          ...(veFinanceiroCompleto(user)
            ? [{ href: "/interno/financeiro", texto: "Financeiro" }]
            : []),
          ...(can(user, "declaracoes:aprovar") || can(user, "declaracoes:emitir")
            ? [{ href: "/interno/pedidos", texto: "Pedidos" }]
            : []),
          ...(can(user, "utilizadores:ver")
            ? [{ href: "/interno/utilizadores", texto: "Utilizadores" }]
            : []),
        ]}
      />
      {children}
    </>
  );
}
