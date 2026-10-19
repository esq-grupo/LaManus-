import { NavPortal } from "@/components/NavPortal";
import { exigirArea } from "@/server/auth/dal";
import { contarNaoLidos } from "@/server/modules/notificacoes";

// A verificação autoritativa acontece aqui (servidor, BD), não no proxy.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await exigirArea("estudante");
  return (
    <>
      <NavPortal
        titulo="Portal do Estudante"
        nome={user.nome}
        base="/estudante"
        porLer={await contarNaoLidos(user)}
      />
      {children}
    </>
  );
}
