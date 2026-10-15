"use server";

import { redirect } from "next/navigation";
import type { Resultado } from "@/components/FormAcao";
import { correrAccao } from "@/server/accao";
import * as estrutura from "@/server/modules/estrutura";
import * as matriculas from "@/server/modules/matriculas";
import * as pessoas from "@/server/modules/pessoas";

const correr = correrAccao;

const obj = (f: FormData) => Object.fromEntries(f.entries());
const E = "/interno/estrutura";
const S = "/interno/estudantes";

// ── Estrutura escolar ────────────────────────────────────────────────────────
export async function acaoAno(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.criarAnoLectivo(a, obj(f), ip), "Ano lectivo criado."),
    [E],
  );
}
export async function acaoEstadoAno(_: Resultado | undefined, f: FormData) {
  const estado = f.get("estado") === "FECHADO" ? "FECHADO" : "ACTIVO";
  return correr(
    "estrutura:editar",
    async (a, ip) => (
      await estrutura.mudarEstadoAnoLectivo(a, String(f.get("id")), estado, ip),
      estado === "ACTIVO" ? "Ano activado." : "Ano fechado."
    ),
    [E],
  );
}
export async function acaoPeriodo(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.criarPeriodo(a, obj(f), ip), "Período criado."),
    [E],
  );
}
export async function acaoClasse(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.criarClasse(a, obj(f), ip), "Classe criada."),
    [E],
  );
}
export async function acaoDisciplina(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.criarDisciplina(a, obj(f), ip), "Disciplina criada."),
    [E],
  );
}
export async function acaoTurma(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.criarTurma(a, obj(f), ip), "Turma criada."),
    [E],
  );
}
export async function acaoFuncionario(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.criarFuncionario(a, obj(f), ip), "Funcionário criado."),
    [E],
  );
}
export async function acaoDocente(_: Resultado | undefined, f: FormData) {
  return correr(
    "estrutura:editar",
    async (a, ip) => (await estrutura.atribuirDocente(a, obj(f), ip), "Docente atribuído."),
    [E],
  );
}

// ── Estudantes, encarregados, matrículas ─────────────────────────────────────
export async function acaoEstudante(_: Resultado | undefined, f: FormData): Promise<Resultado> {
  let id: string | undefined;
  const r = await correr(
    "estudantes:editar",
    async (a, ip) => ((id = await pessoas.criarEstudante(a, obj(f), ip)), "Estudante criado."),
    [S],
  );
  if (id) redirect(`${S}/${id}`);
  return r;
}
export async function acaoActualizarEstudante(_: Resultado | undefined, f: FormData) {
  const id = String(f.get("id"));
  return correr(
    "estudantes:editar",
    async (a, ip) => (await pessoas.actualizarEstudante(a, id, obj(f), ip), "Dados guardados."),
    [S, `${S}/${id}`],
  );
}
export async function acaoLigarEncarregado(_: Resultado | undefined, f: FormData) {
  const id = String(f.get("estudanteId"));
  return correr(
    "estudantes:editar",
    async (a, ip) => (
      await pessoas.ligarEncarregado(a, obj(f), ip),
      "Encarregado ligado. Falta verificar a ligação."
    ),
    [`${S}/${id}`],
  );
}
export async function acaoVerificar(_: Resultado | undefined, f: FormData) {
  const e = String(f.get("estudanteId"));
  return correr(
    "estudantes:editar",
    async (a, ip) => (
      await pessoas.verificarLigacao(a, e, String(f.get("encarregadoId")), ip),
      "Ligação verificada."
    ),
    [`${S}/${e}`],
  );
}
export async function acaoAutorizacao(_: Resultado | undefined, f: FormData) {
  const e = String(f.get("estudanteId"));
  const activa = f.get("activa") === "true";
  return correr(
    "estudantes:editar",
    async (a, ip) => (
      await pessoas.definirAutorizacao(a, e, String(f.get("encarregadoId")), activa, ip),
      activa ? "Autorização reposta." : "Autorização revogada."
    ),
    [`${S}/${e}`],
  );
}
export async function acaoAssociarConta(_: Resultado | undefined, f: FormData) {
  const e = String(f.get("estudanteId"));
  const tipo = f.get("tipo") === "estudante" ? "estudante" : "encarregado";
  return correr(
    "estudantes:editar",
    async (a, ip) => (
      await pessoas.associarConta(a, { tipo, id: String(f.get("id")) }, String(f.get("email")), ip),
      "Conta associada."
    ),
    [`${S}/${e}`],
  );
}
export async function acaoMatricular(_: Resultado | undefined, f: FormData) {
  const e = String(f.get("estudanteId"));
  return correr(
    "estudantes:editar",
    async (a, ip) => (await matriculas.matricular(a, obj(f), ip), "Matrícula criada."),
    [`${S}/${e}`, S],
  );
}
export async function acaoTransferir(_: Resultado | undefined, f: FormData) {
  const e = String(f.get("estudanteId"));
  return correr(
    "estudantes:editar",
    async (a, ip) => (await matriculas.transferirTurma(a, obj(f), ip), "Transferência concluída."),
    [`${S}/${e}`, S],
  );
}
export async function acaoAnular(_: Resultado | undefined, f: FormData) {
  const e = String(f.get("estudanteId"));
  return correr(
    "estudantes:editar",
    async (a, ip) => (
      await matriculas.anularMatricula(
        a,
        String(f.get("matriculaId")),
        String(f.get("motivo")),
        ip,
      ),
      "Matrícula anulada."
    ),
    [`${S}/${e}`, S],
  );
}
