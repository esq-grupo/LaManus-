import type { PrismaClient } from "@/generated/prisma/client";
import { hojeEmLuanda } from "@/lib/datas";
import { normalizarTexto } from "@/lib/migracao/validar";
import type { Contexto, Plano } from "@/lib/migracao/tipos";

// Aplicação (e reversão) de um lote de importação. Corre com a ligação de ADMINISTRAÇÃO (dono), fora da aplicação web:
// a importação é um acto de administração autorizado, não uma funcionalidade aberta a utilizadores.

export const TIPO_SALDO = "Saldo transitado";
const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function carregarContexto(db: PrismaClient, agora = new Date()): Promise<Contexto> {
  const [estudantes, encarregados, ligacoes, matriculas, turmas, anos, saldos] = await Promise.all([
    db.estudante.findMany({
      select: { numeroProcesso: true, nome: true, dataNascimento: true, bi: true },
    }),
    db.encarregado.findMany({ where: { bi: { not: null } }, select: { bi: true, nome: true } }),
    db.estudanteEncarregado.findMany({
      select: {
        estudante: { select: { numeroProcesso: true } },
        encarregado: { select: { bi: true } },
      },
    }),
    db.matricula.findMany({
      select: {
        estudante: { select: { numeroProcesso: true } },
        anoLectivoId: true,
        tipo: true,
        estado: true,
      },
    }),
    db.turma.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        nome: true,
        anoLectivoId: true,
        classe: { select: { nome: true } },
        anoLectivo: { select: { nome: true } },
      },
    }),
    db.anoLectivo.findMany({ select: { id: true, nome: true } }),
    db.encargo.findMany({
      where: { referencia: { startsWith: "ABERTURA-" } },
      select: { anoLectivoId: true, estudante: { select: { numeroProcesso: true } } },
    }),
  ]);
  return {
    hoje: hojeEmLuanda(agora),
    estudantes: new Map(
      estudantes.map((e) => [
        e.numeroProcesso,
        { nome: e.nome, dataNascimento: iso(e.dataNascimento), bi: e.bi },
      ]),
    ),
    biDeEstudantes: new Map(estudantes.filter((e) => e.bi).map((e) => [e.bi!, e.numeroProcesso])),
    encarregados: new Map(encarregados.map((e) => [e.bi!, { nome: e.nome }])),
    ligacoes: new Set(
      ligacoes
        .filter((l) => l.encarregado.bi)
        .map((l) => `${l.estudante.numeroProcesso}|${l.encarregado.bi}`),
    ),
    matriculas: matriculas.map((m) => ({
      numeroProcesso: m.estudante.numeroProcesso,
      anoLectivoId: m.anoLectivoId,
      tipo: m.tipo,
      estado: m.estado,
    })),
    turmas: new Map(
      turmas.map((t) => [
        [t.anoLectivo.nome, t.classe.nome, t.nome].map(normalizarTexto).join("|"),
        { turmaId: t.id, anoLectivoId: t.anoLectivoId },
      ]),
    ),
    anos: new Map(anos.map((a) => [normalizarTexto(a.nome), a.id])),
    saldosExistentes: new Set(saldos.map((s) => `${s.estudante.numeroProcesso}|${s.anoLectivoId}`)),
  };
}

export interface Manifesto {
  estudantes: string[];
  encarregados: string[];
  ligacoes: { estudanteId: string; encarregadoId: string }[];
  matriculas: string[];
  encargos: string[];
}

/**
 * Grava o plano numa única transacção e regista o lote (só IDs no manifesto). Ligações entram SEMPRE por verificar
 * (`verificado=false`): importar dados nunca dá acesso aos portais. Saldos entram como encargos de abertura.
 */
export async function aplicarPlano(
  db: PrismaClient,
  plano: Plano,
  meta: { ficheiro: string; sha256: string },
) {
  return db.$transaction(
    async (tx) => {
      const man: Manifesto = {
        estudantes: [],
        encarregados: [],
        ligacoes: [],
        matriculas: [],
        encargos: [],
      };
      const idEst = new Map<string, string>();
      const idEnc = new Map<string, string>();
      for (const e of plano.estudantes) {
        const c = await tx.estudante.create({
          data: {
            numeroProcesso: e.numeroProcesso,
            nome: e.nome,
            dataNascimento: new Date(`${e.dataNascimento}T00:00:00.000Z`),
            bi: e.bi,
            contacto: e.contacto,
          },
        });
        idEst.set(e.numeroProcesso, c.id);
        man.estudantes.push(c.id);
      }
      for (const e of plano.encarregados) {
        const c = await tx.encarregado.create({
          data: { nome: e.nome, bi: e.bi, contacto: e.contacto },
        });
        idEnc.set(e.bi, c.id);
        man.encarregados.push(c.id);
      }
      const estudanteId = async (np: string) =>
        idEst.get(np) ??
        (await tx.estudante.findUniqueOrThrow({ where: { numeroProcesso: np } })).id;
      const encarregadoId = async (bi: string) =>
        idEnc.get(bi) ?? (await tx.encarregado.findUniqueOrThrow({ where: { bi } })).id;
      for (const l of plano.ligacoes) {
        const par = {
          estudanteId: await estudanteId(l.numeroProcesso),
          encarregadoId: await encarregadoId(l.bi),
        };
        await tx.estudanteEncarregado.create({
          data: {
            ...par,
            parentesco: l.parentesco,
            principal: l.principal,
            verificado: false,
            autorizacaoActiva: true,
          },
        });
        man.ligacoes.push(par);
      }
      for (const m of plano.matriculas) {
        const c = await tx.matricula.create({
          data: {
            estudanteId: await estudanteId(m.numeroProcesso),
            turmaId: m.turmaId,
            anoLectivoId: m.anoLectivoId,
            tipo: m.tipo,
            estado: "ACTIVA",
          },
        });
        man.matriculas.push(c.id);
      }
      if (plano.saldos.length > 0) {
        const tipo =
          (await tx.tipoEncargo.findUnique({ where: { nome: TIPO_SALDO } })) ??
          (await tx.tipoEncargo.create({
            data: { nome: TIPO_SALDO, valorReferencia: 0n, periodicidade: "UNICO" },
          }));
        for (const s of plano.saldos) {
          const c = await tx.encargo.create({
            data: {
              estudanteId: await estudanteId(s.numeroProcesso),
              tipoEncargoId: tipo.id,
              anoLectivoId: s.anoLectivoId,
              referencia: `ABERTURA-${s.anoLectivoId}`,
              descricao: s.descricao,
              valor: s.valorCentimos,
              vencimento: new Date(`${s.vencimento}T00:00:00.000Z`),
            },
          });
          man.encargos.push(c.id);
        }
      }
      const resumo = {
        importadas: {
          estudantes: plano.estudantes.length,
          encarregados: plano.encarregados.length,
          ligacoes: plano.ligacoes.length,
          matriculas: plano.matriculas.length,
          saldos: plano.saldos.length,
        },
        rejeitadas: plano.problemas.filter((p) => p.tipo === "REJEITADA").length,
        transformadas: plano.problemas.filter((p) => p.tipo === "TRANSFORMADA").length,
        jaExistiam: plano.problemas.filter((p) => p.tipo === "JA_EXISTE").length,
      };
      const lote = await tx.loteMigracao.create({
        data: {
          ficheiro: meta.ficheiro,
          ficheiroSha256: meta.sha256,
          resumo,
          manifesto: man as unknown as object,
        },
      });
      // Evento de origem BD (o dono escreve); sem dados pessoais.
      await tx.eventoAuditoria.create({
        data: {
          acao: "LOTE_MIGRACAO_APLICADO",
          entidade: "LoteMigracao",
          entidadeId: lote.id,
          depois: { ...resumo, ficheiroSha256: meta.sha256 },
        },
      });
      return { lote, resumo };
    },
    { timeout: 120_000 },
  );
}

export class ErroReversao extends Error {
  constructor(public motivos: string[]) {
    super(`Não é seguro reverter este lote: ${motivos.join("; ")}.`);
    this.name = "ErroReversao";
  }
}

/**
 * Anula um lote (apaga o que ele criou) — só se NADA mudou desde a importação. Se alguém já alterou, verificou, usou ou
 * ligou contas aos registos importados, recusa SEM apagar nada (revisão do Codex à H2): nesse caso corrige-se à mão.
 */
export async function reverterLote(
  db: PrismaClient,
  loteId: string,
  opcoes: { aposVerificar?: () => Promise<void> } = {},
) {
  return db.$transaction(
    async (tx) => {
      // O lote e os registos importados ficam BLOQUEADOS até ao fim: quem tentar alterá-los, usá-los (chave estrangeira:
      // matrícula, pagamento, nota…) ou reverter o mesmo lote em simultâneo espera, e depois já vê o lote revertido.
      const bloqueado = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "LoteMigracao" WHERE id = ${loteId}::uuid FOR UPDATE`;
      if (bloqueado.length === 0) throw new Error("Lote inexistente.");
      const lote = await tx.loteMigracao.findUniqueOrThrow({ where: { id: loteId } });
      if (lote.estado !== "APLICADO") throw new Error("O lote já foi revertido.");
      const m = lote.manifesto as unknown as Manifesto;
      await tx.$queryRaw`SELECT id FROM "Estudante" WHERE id = ANY(${m.estudantes}::uuid[]) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Encarregado" WHERE id = ANY(${m.encarregados}::uuid[]) ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT "estudanteId" FROM "EstudanteEncarregado" WHERE "estudanteId" = ANY(${m.estudantes}::uuid[]) OR "encarregadoId" = ANY(${m.encarregados}::uuid[]) ORDER BY "estudanteId", "encarregadoId" FOR UPDATE`;
      const motivos: string[] = [];
      const razao = (n: number, texto: string) => n > 0 && motivos.push(`${n} ${texto}`);
      const ests = { in: m.estudantes };
      const encs = { in: m.encarregados };

      razao(
        await tx.estudante.count({
          where: {
            id: ests,
            OR: [
              { updatedAt: { gt: lote.criadoEm } },
              { userId: { not: null } },
              { archivedAt: { not: null } },
            ],
          },
        }),
        "estudante(s) alterado(s), arquivado(s) ou com conta associada depois da importação",
      );
      razao(
        await tx.encarregado.count({
          where: {
            id: encs,
            OR: [
              { updatedAt: { gt: lote.criadoEm } },
              { userId: { not: null } },
              { archivedAt: { not: null } },
            ],
          },
        }),
        "encarregado(s) alterado(s) ou com conta associada depois da importação",
      );
      for (const l of m.ligacoes) {
        const lig = await tx.estudanteEncarregado.findUnique({
          where: { estudanteId_encarregadoId: l },
        });
        if (
          lig &&
          (lig.verificado ||
            lig.verificadoEm ||
            !lig.autorizacaoActiva ||
            lig.validoDe ||
            lig.validoAte)
        ) {
          razao(1, "ligação(ões) verificada(s) ou alterada(s) pela Secretaria");
          break;
        }
      }
      // Encarregados do lote ligados a OUTROS estudantes (não importados por este lote) ou estudantes com outras ligações.
      razao(
        await tx.estudanteEncarregado.count({
          where: {
            OR: [
              { encarregadoId: encs, estudanteId: { notIn: m.estudantes } },
              { estudanteId: ests, encarregadoId: { notIn: m.encarregados } },
            ],
          },
        }),
        "ligação(ões) criada(s) fora do lote",
      );
      razao(
        await tx.matricula.count({
          where: {
            estudanteId: ests,
            OR: [{ id: { notIn: m.matriculas } }, { estado: { not: "ACTIVA" } }],
          },
        }),
        "matrícula(s) nova(s) ou alterada(s) depois da importação",
      );
      razao(
        await tx.encargo.count({ where: { estudanteId: ests, id: { notIn: m.encargos } } }),
        "encargo(s) criado(s) depois da importação",
      );
      razao(
        await tx.alocacaoPagamento.count({ where: { estudanteId: ests } }),
        "alocação(ões) de pagamentos",
      );
      razao(await tx.pagamento.count({ where: { estudanteId: ests } }), "pagamento(s)");
      razao(await tx.nota.count({ where: { estudanteId: ests } }), "nota(s) lançada(s)");
      razao(
        await tx.pedidoDeclaracao.count({ where: { estudanteId: ests } }),
        "pedido(s) de declaração",
      );
      razao(await tx.notificacao.count({ where: { estudanteId: ests } }), "aviso(s) enviado(s)");
      if (motivos.length > 0) throw new ErroReversao(motivos);
      await opcoes.aposVerificar?.();

      await tx.encargo.deleteMany({ where: { id: { in: m.encargos } } });
      await tx.matricula.deleteMany({ where: { id: { in: m.matriculas } } });
      for (const l of m.ligacoes) await tx.estudanteEncarregado.deleteMany({ where: l });
      await tx.encarregado.deleteMany({ where: { id: encs, estudantes: { none: {} } } });
      await tx.estudante.deleteMany({ where: { id: ests } });
      await tx.loteMigracao.update({
        where: { id: loteId },
        data: { estado: "REVERTIDO", revertidoEm: new Date() },
      });
      await tx.eventoAuditoria.create({
        data: { acao: "LOTE_MIGRACAO_REVERTIDO", entidade: "LoteMigracao", entidadeId: loteId },
      });
    },
    { timeout: 120_000 },
  );
}
