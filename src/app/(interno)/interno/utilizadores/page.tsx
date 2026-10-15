import { GestaoUtilizadoresLista } from "./lista";
import { can } from "@/server/authz";
import { exigirPermissao } from "@/server/auth/dal";
import { contarUtilizadores, listarUtilizadores } from "@/server/modules/utilizadores";

export const metadata = { title: "Utilizadores — Lá Manu" };

export default async function Utilizadores({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await exigirPermissao("utilizadores:ver");
  const { q = "" } = await searchParams;
  const [utilizadores, total] = await Promise.all([
    listarUtilizadores(actor, { q }),
    contarUtilizadores(actor, q),
  ]);
  return (
    <GestaoUtilizadoresLista
      q={q}
      total={total}
      utilizadores={utilizadores}
      actorId={actor.id}
      podeGerir={can(actor, "utilizadores:gerir")}
    />
  );
}
