import { CabecalhoArea } from "@/components/CabecalhoArea";
import { exigirArea } from "@/server/auth/dal";

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
          { href: "/interno/utilizadores", texto: "Utilizadores" },
        ]}
      />
      {children}
    </>
  );
}
