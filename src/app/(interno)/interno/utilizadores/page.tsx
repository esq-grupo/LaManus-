import { GestaoUtilizadoresLista } from "./lista";
import { can } from "@/server/authz";
import { exigirPermissao } from "@/server/auth/dal";
import { listarUtilizadores } from "@/server/modules/utilizadores";

export const metadata = { title: "Utilizadores — Lá Manu" };

export default async function Utilizadores() {
  const actor = await exigirPermissao("utilizadores:ver");
  const utilizadores = await listarUtilizadores(actor);
  return (
    <GestaoUtilizadoresLista
      utilizadores={utilizadores}
      actorId={actor.id}
      podeGerir={can(actor, "utilizadores:gerir")}
    />
  );
}
