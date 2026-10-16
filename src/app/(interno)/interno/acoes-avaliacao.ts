"use server";

import type { Resultado } from "@/components/FormAcao";
import { correrAccao } from "@/server/accao";
import { tokenDaSessao } from "@/server/auth/dal";
import { criarAvaliacao, lancarNotas } from "@/server/modules/avaliacao";
import { corrigirNota, publicarPauta, reabrirPauta, validarPauta } from "@/server/modules/pautas";

const N = "/interno/notas";
const P = "/interno/pautas";

export async function acaoAvaliacao(_: Resultado | undefined, f: FormData) {
  return correrAccao(
    "notas:lancar",
    async (a, ip) => (
      await criarAvaliacao(a, Object.fromEntries(f.entries()), ip),
      "Avaliação criada."
    ),
    [N],
  );
}

/** Os campos chamam-se `nota-<id do estudante>`; o servidor revalida tudo (matrícula, valor, pauta, docente). */
export async function acaoNotas(_: Resultado | undefined, f: FormData) {
  const avaliacaoId = String(f.get("avaliacaoId"));
  const entradas = [...f.entries()]
    .filter(([k]) => k.startsWith("nota-"))
    .map(([k, v]) => ({ estudanteId: k.slice(5), valor: String(v) }));
  return correrAccao(
    "notas:lancar",
    async (a, ip) => {
      const r = await lancarNotas(a, avaliacaoId, entradas, ip);
      return r.criadas + r.alteradas === 0
        ? "Nada a alterar."
        : `Notas guardadas (${r.criadas} novas, ${r.alteradas} alteradas).`;
    },
    [N, `${N}/avaliacao/${avaliacaoId}`],
  );
}

export async function acaoValidarPauta(_: Resultado | undefined, f: FormData) {
  const [t, p] = [String(f.get("turmaId")), String(f.get("periodoId"))];
  return correrAccao(
    "pauta:publicar",
    async (a, ip) => (await validarPauta(a, t, p, ip), "Pauta validada."),
    [P, `${P}/${t}/${p}`],
  );
}
export async function acaoPublicarPauta(_: Resultado | undefined, f: FormData) {
  const [t, p] = [String(f.get("turmaId")), String(f.get("periodoId"))];
  return correrAccao(
    "pauta:publicar",
    async (a, ip) => (
      await publicarPauta(a, t, p, ip),
      "Pauta publicada: os estudantes e encarregados já vêem as notas."
    ),
    [P, `${P}/${t}/${p}`],
  );
}
export async function acaoReabrirPauta(_: Resultado | undefined, f: FormData) {
  const [t, p] = [String(f.get("turmaId")), String(f.get("periodoId"))];
  return correrAccao(
    "pauta:publicar",
    async (a, ip) => (await reabrirPauta(a, t, p, String(f.get("motivo")), ip), "Pauta reaberta."),
    [P, `${P}/${t}/${p}`],
  );
}
export async function acaoCorrigirNota(_: Resultado | undefined, f: FormData) {
  const [t, p] = [String(f.get("turmaId")), String(f.get("periodoId"))];
  return correrAccao(
    "notas:corrigir",
    async (a, ip) => (
      await corrigirNota(
        a,
        String(f.get("notaId")),
        String(f.get("valor")),
        String(f.get("motivo")),
        { tokenSessao: await tokenDaSessao(), ip },
      ),
      "Nota corrigida e registada."
    ),
    [`${P}/${t}/${p}`],
  );
}
