import { CabecalhoArea } from "@/components/CabecalhoArea";
import { exigirArea } from "@/server/auth/dal";

// A verificação autoritativa acontece aqui (servidor, BD), não no proxy.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await exigirArea("estudante");
  return (
    <>
      <CabecalhoArea titulo="Portal do Estudante" nome={user.nome} />
      {children}
    </>
  );
}
