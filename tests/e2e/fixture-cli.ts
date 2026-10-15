// Executado com `tsx` num processo à parte (o Playwright compila para CommonJS e não consegue carregar o cliente Prisma).
import "dotenv/config";
import {
  criarFixtureAvaliacao,
  limparFixtureAvaliacao,
  type IdsFixture,
} from "./fixture-avaliacao";
import { db } from "../../src/server/db";

async function main() {
  const [, , comando, argumento] = process.argv;
  if (comando === "criar") {
    const fx = await criarFixtureAvaliacao(argumento ?? "");
    console.log(`JSON:${JSON.stringify(fx)}`);
  } else if (comando === "limpar") {
    await limparFixtureAvaliacao(JSON.parse(argumento ?? "{}") as IdsFixture);
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
