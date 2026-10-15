import type { Prisma } from "@/generated/prisma/client";

export type EstadoPautaTexto = "RASCUNHO" | "VALIDADA" | "PUBLICADA";

/**
 * Garante que a pauta (turma × período) existe e BLOQUEIA a linha até ao fim da transacção.
 *  - `partilhado` (FOR SHARE): lançamentos de notas — vários em simultâneo, mas nunca durante uma validação;
 *  - `exclusivo` (FOR UPDATE): validar/publicar/reabrir — espera que os lançamentos em curso terminem e impede novos.
 * Assim «validar» e «lançar nota» nunca se cruzam (o que foi validado é exactamente o que está gravado).
 */
export async function bloquearPauta(
  tx: Prisma.TransactionClient,
  alvo: { turmaId: string; periodoId: string; anoLectivoId: string },
  modo: "partilhado" | "exclusivo",
): Promise<EstadoPautaTexto> {
  await tx.$executeRaw`INSERT INTO "PautaPublicacao" (id, "turmaId", "periodoId", "anoLectivoId", "updatedAt")
    VALUES (gen_random_uuid(), ${alvo.turmaId}::uuid, ${alvo.periodoId}::uuid, ${alvo.anoLectivoId}::uuid, now())
    ON CONFLICT ("turmaId", "periodoId") DO NOTHING`;
  const linhas =
    modo === "partilhado"
      ? await tx.$queryRaw<
          { estado: EstadoPautaTexto }[]
        >`SELECT estado::text AS estado FROM "PautaPublicacao" WHERE "turmaId" = ${alvo.turmaId}::uuid AND "periodoId" = ${alvo.periodoId}::uuid FOR SHARE`
      : await tx.$queryRaw<
          { estado: EstadoPautaTexto }[]
        >`SELECT estado::text AS estado FROM "PautaPublicacao" WHERE "turmaId" = ${alvo.turmaId}::uuid AND "periodoId" = ${alvo.periodoId}::uuid FOR UPDATE`;
  const estado = linhas[0]?.estado;
  if (!estado) throw new Error("Pauta não encontrada após criação");
  return estado;
}
