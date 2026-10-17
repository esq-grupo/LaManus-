// Executado com `tsx` num processo à parte (o Playwright compila para CommonJS e não consegue carregar o cliente Prisma).
import "dotenv/config";
import {
  criarFixtureAvaliacao,
  limparFixtureAvaliacao,
  type IdsFixture,
} from "./fixture-avaliacao";
import { db } from "../../src/server/db";
import { criarClienteAdmin } from "../../scripts/db-admin";

/** Remove os movimentos financeiros criados pelos testes e2e (o livro é imutável para a aplicação: só o dono apaga). */
async function limparFinanceiroE2E() {
  const admin = criarClienteAdmin();
  try {
    const ests = {
      in: (
        await admin.estudante.findMany({
          where: { numeroProcesso: { startsWith: "TESTE-" } },
          select: { id: true },
        })
      ).map((e) => e.id),
    };
    await admin.$transaction(async (tx) => {
      await tx.recibo.deleteMany({ where: { estudanteId: ests } });
      await tx.estornoAlocacao.deleteMany({
        where: { estorno: { pagamento: { estudanteId: ests } } },
      });
      await tx.estorno.deleteMany({ where: { pagamento: { estudanteId: ests } } });
      await tx.alocacaoPagamento.deleteMany({ where: { estudanteId: ests } });
      await tx.pagamento.deleteMany({ where: { estudanteId: ests } });
      const tipos = (
        await tx.tipoEncargo.findMany({
          where: { nome: { startsWith: "E2E-FIN-" } },
          select: { id: true },
        })
      ).map((t) => t.id);
      await tx.encargo.deleteMany({ where: { tipoEncargoId: { in: tipos } } });
      await tx.tipoEncargo.deleteMany({ where: { nome: { startsWith: "E2E-FIN-" } } });
    });
  } finally {
    await admin.$disconnect();
  }
}

async function main() {
  const [, , comando, argumento] = process.argv;
  if (comando === "criar") {
    const fx = await criarFixtureAvaliacao(argumento ?? "");
    console.log(`JSON:${JSON.stringify(fx)}`);
  } else if (comando === "limpar") {
    await limparFixtureAvaliacao(JSON.parse(argumento ?? "{}") as IdsFixture);
    console.log("JSON:{}");
  } else if (comando === "financeiro-limpar") {
    await limparFinanceiroE2E();
    console.log("JSON:{}");
  } else {
    throw new Error(`Comando desconhecido: ${comando}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
