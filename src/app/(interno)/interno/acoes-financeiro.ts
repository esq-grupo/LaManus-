"use server";

import type { Resultado } from "@/components/FormAcao";
import { correrAccao } from "@/server/accao";
import { tokenDaSessao } from "@/server/auth/dal";
import {
  alocarManual,
  anularEncargo,
  anularPagamento,
  aprovarEstorno,
  confirmarPagamento,
  criarEncargo,
  criarTipo,
  gerarEncargosMensais,
  proporEstorno,
  registarPagamento,
  rejeitarEstorno,
} from "@/server/modules/financeiro";

const F = "/interno/financeiro";
const texto = (f: FormData, k: string) => String(f.get(k) ?? "");
const dados = (f: FormData) => Object.fromEntries(f.entries());

export async function acaoCriarTipo(_: Resultado | undefined, f: FormData) {
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => (await criarTipo(a, dados(f), ip), "Tipo de encargo criado."),
    [F],
  );
}

export async function acaoGerarPropinas(_: Resultado | undefined, f: FormData) {
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => {
      const r = await gerarEncargosMensais(a, dados(f), ip);
      return `Propinas geradas: ${r.criados} novas (${r.jaExistentes} já existiam).`;
    },
    [F],
  );
}

export async function acaoCriarEncargo(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => (await criarEncargo(a, dados(f), ip), "Encargo criado."),
    [`${F}/estudante/${est}`],
  );
}

export async function acaoAnularEncargo(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => (
      await anularEncargo(a, texto(f, "encargoId"), texto(f, "motivo"), ip),
      "Encargo anulado."
    ),
    [`${F}/estudante/${est}`],
  );
}

export async function acaoRegistarPagamento(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => (
      await registarPagamento(a, dados(f), { tokenSessao: await tokenDaSessao(), ip }),
      "Pagamento registado. Aguarda a confirmação da Direcção."
    ),
    [F, `${F}/estudante/${est}`],
  );
}

export async function acaoAnularPagamento(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => (
      await anularPagamento(a, texto(f, "pagamentoId"), texto(f, "motivo"), {
        tokenSessao: await tokenDaSessao(),
        ip,
      }),
      "Registo anulado."
    ),
    [F, `${F}/estudante/${est}`],
  );
}

export async function acaoConfirmarPagamento(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "pagamento:confirmar",
    async (a, ip) => (
      await confirmarPagamento(a, texto(f, "pagamentoId"), {
        tokenSessao: await tokenDaSessao(),
        ip,
      }),
      "Pagamento confirmado e recibo emitido."
    ),
    [F, `${F}/estudante/${est}`],
  );
}

export async function acaoAlocarManual(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "financeiro:editar",
    async (a, ip) => (
      await alocarManual(
        a,
        {
          pagamentoId: texto(f, "pagamentoId"),
          encargoId: texto(f, "encargoId"),
          valorKz: texto(f, "valorKz"),
        },
        { tokenSessao: await tokenDaSessao(), ip },
      ),
      "Valor alocado."
    ),
    [`${F}/estudante/${est}`],
  );
}

export async function acaoProporEstorno(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "estorno:propor",
    async (a, ip) => (
      await proporEstorno(
        a,
        {
          pagamentoId: texto(f, "pagamentoId"),
          valorKz: texto(f, "valorKz"),
          motivo: texto(f, "motivo"),
        },
        { tokenSessao: await tokenDaSessao(), ip },
      ),
      "Estorno proposto. Aguarda a aprovação da Direcção."
    ),
    [F, `${F}/estudante/${est}`],
  );
}

export async function acaoAprovarEstorno(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "estorno:aprovar",
    async (a, ip) => (
      await aprovarEstorno(a, texto(f, "estornoId"), texto(f, "motivo"), {
        tokenSessao: await tokenDaSessao(),
        ip,
      }),
      "Estorno aprovado."
    ),
    [F, `${F}/estudante/${est}`],
  );
}

export async function acaoRejeitarEstorno(_: Resultado | undefined, f: FormData) {
  const est = texto(f, "estudanteId");
  return correrAccao(
    "estorno:aprovar",
    async (a, ip) => (
      await rejeitarEstorno(a, texto(f, "estornoId"), texto(f, "motivo"), {
        tokenSessao: await tokenDaSessao(),
        ip,
      }),
      "Estorno rejeitado."
    ),
    [F, `${F}/estudante/${est}`],
  );
}
