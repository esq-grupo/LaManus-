import { GestaoUtilizadoresLista } from "./lista";
import { can } from "@/server/authz";
import { exigirPermissao } from "@/server/auth/dal";
import {
  LIMITE_LISTA_UTILIZADORES,
  limparPesquisaUtilizadores,
  paginarUtilizadores,
} from "@/server/modules/utilizadores";

export const metadata = { title: "Utilizadores — Lá Manu" };

export default async function Utilizadores({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; pagina?: string | string[] }>;
}) {
  const actor = await exigirPermissao("utilizadores:ver");
  const params = await searchParams;
  const q = limparPesquisaUtilizadores(typeof params.q === "string" ? params.q : undefined);
  const pagina = typeof params.pagina === "string" ? params.pagina : undefined;
  const resultado = await paginarUtilizadores(actor, {
    q,
    pagina,
    limite: LIMITE_LISTA_UTILIZADORES,
  });
  return (
    <GestaoUtilizadoresLista
      q={q}
      total={resultado.total}
      pagina={resultado.pagina}
      paginas={resultado.paginas}
      de={resultado.de}
      ate={resultado.ate}
      utilizadores={resultado.itens}
      actorId={actor.id}
      podeGerir={can(actor, "utilizadores:gerir")}
    />
  );
}
