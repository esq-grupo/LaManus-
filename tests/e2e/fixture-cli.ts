// Executado com `tsx` num processo à parte (o Playwright compila para CommonJS e não consegue carregar o cliente Prisma).
import "dotenv/config";
import {
  criarFixtureAvaliacao,
  limparFixtureAvaliacao,
  type IdsFixture,
} from "./fixture-avaliacao";
import { db } from "../../src/server/db";
import { criarClienteAdmin } from "../../scripts/db-admin";
import { hashPassword } from "../../src/server/auth/password";

export interface FixturePortais {
  email: string;
  educandoA: { id: string; nome: string };
  educandoB: { id: string; nome: string };
  naoVerificado: { id: string; nome: string };
  alheio: { id: string; nome: string };
  userId: string;
  encarregadoId: string;
}

/** Encarregado com 2 educandos verificados, 1 por verificar e 1 aluno de OUTRA família (para os testes de acesso cruzado). */
async function criarPortais(senha: string): Promise<FixturePortais> {
  const admin = criarClienteAdmin();
  try {
    const sufixo = Date.now().toString().slice(-8);
    const role = await admin.role.findUniqueOrThrow({ where: { codigo: "ENCARREGADO" } });
    const email = `enc-port-${sufixo}@exemplo.lamanu.test`;
    const user = await admin.user.create({
      data: {
        email,
        nome: "Encarregado E2E Portais",
        passwordHash: await hashPassword(senha),
        papeis: { create: [{ roleId: role.id }] },
      },
    });
    const enc = await admin.encarregado.create({
      data: { nome: "Encarregado E2E Portais", userId: user.id },
    });
    const mk = async (nome: string, n: string) =>
      admin.estudante.create({
        data: {
          numeroProcesso: `PORT-${n}-${sufixo}`,
          nome: `${nome} ${sufixo}`,
          dataNascimento: new Date("2013-03-03"),
        },
      });
    const [a, b, c, d] = [
      await mk("Aluno Alfa", "A"),
      await mk("Aluno Beta", "B"),
      await mk("Aluno Gama", "C"),
      await mk("Aluno Alheio", "D"),
    ];
    for (const [e, verificado] of [
      [a, true],
      [b, true],
      [c, false],
    ] as const)
      await admin.estudanteEncarregado.create({
        data: {
          estudanteId: e.id,
          encarregadoId: enc.id,
          parentesco: "Pai",
          verificado,
          autorizacaoActiva: true,
        },
      });
    const v = (e: { id: string; nome: string }) => ({ id: e.id, nome: e.nome });
    return {
      email,
      educandoA: v(a),
      educandoB: v(b),
      naoVerificado: v(c),
      alheio: v(d),
      userId: user.id,
      encarregadoId: enc.id,
    };
  } finally {
    await admin.$disconnect();
  }
}

async function limparPortais(fx: FixturePortais) {
  const admin = criarClienteAdmin();
  try {
    const ids = [fx.educandoA.id, fx.educandoB.id, fx.naoVerificado.id, fx.alheio.id];
    await admin.estudanteEncarregado.deleteMany({ where: { encarregadoId: fx.encarregadoId } });
    await admin.session.deleteMany({ where: { userId: fx.userId } });
    await admin.encarregado.delete({ where: { id: fx.encarregadoId } });
    await admin.user.delete({ where: { id: fx.userId } });
    await admin.estudante.deleteMany({ where: { id: { in: ids } } });
  } finally {
    await admin.$disconnect();
  }
}

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
  } else if (comando === "portais-criar") {
    console.log(`JSON:${JSON.stringify(await criarPortais(argumento ?? ""))}`);
  } else if (comando === "portais-limpar") {
    await limparPortais(JSON.parse(argumento ?? "{}") as FixturePortais);
    console.log("JSON:{}");
  } else if (comando === "pedidos-limpar") {
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
      await admin.declaracaoEmitida.deleteMany({ where: { pedido: { estudanteId: ests } } });
      await admin.pedidoDeclaracao.deleteMany({ where: { estudanteId: ests } });
    } finally {
      await admin.$disconnect();
    }
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
