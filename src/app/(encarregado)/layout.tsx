import { NavPortal } from "@/components/NavPortal";
import { exigirArea } from "@/server/auth/dal";
import { contarNaoLidos } from "@/server/modules/notificacoes";

// A verificação autoritativa acontece aqui (servidor, BD), não no proxy.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await exigirArea("encarregado");
  return (
    <>
      <NavPortal
        titulo="Portal do Encarregado"
        nome={user.nome}
        base="/encarregado"
        porLer={await contarNaoLidos(user)}
      />
      {children}
    </>
  );
}
