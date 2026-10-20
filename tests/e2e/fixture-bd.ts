import { execFileSync } from "node:child_process";
import type { FixtureAvaliacao } from "./fixture-avaliacao";

function correr(...args: string[]): unknown {
  const saida = execFileSync("npx", ["tsx", "tests/e2e/fixture-cli.ts", ...args], {
    encoding: "utf8",
    env: process.env,
    timeout: 90_000,
  });
  const linha = saida
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("JSON:"));
  if (!linha) throw new Error(`Sem resposta do fixture: ${saida}`);
  return JSON.parse(linha.slice(5));
}

export const criarFixture = (senha: string) => correr("criar", senha) as FixtureAvaliacao;
export const limparFixture = (fx: FixtureAvaliacao) =>
  void correr("limpar", JSON.stringify(fx.ids));

export const limparFinanceiro = () => void correr("financeiro-limpar");

import type { FixturePortais, FixtureUtilizadoresPaginacao } from "./fixture-cli";
export const criarPortais = (senha: string) => correr("portais-criar", senha) as FixturePortais;
export const limparPortais = (fx: FixturePortais) =>
  void correr("portais-limpar", JSON.stringify(fx));

export const criarUtilizadoresPaginacao = (senha: string) =>
  correr("utilizadores-paginacao-criar", senha) as FixtureUtilizadoresPaginacao;
export const limparUtilizadoresPaginacao = (fx: FixtureUtilizadoresPaginacao) =>
  void correr("utilizadores-paginacao-limpar", JSON.stringify(fx));

export const limparPedidos = () => void correr("pedidos-limpar");
