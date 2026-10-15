import { z } from "zod";
import { db } from "@/server/db";
import { comAuditoria, registarAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { dataSchema } from "@/lib/datas";
import { notaParaCentesimas } from "@/lib/avaliacao";
import { bloquearPauta } from "./pauta-lock";

const uuid = z.string().uuid("Identificador inválido.");

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

const MSG_PAUTA_FECHADA =
  "A pauta deste período já foi validada: já não aceita alterações. Peça à Direcção para a reabrir.";

/**
 * Só o docente DESSA disciplina nessa turma pode mexer em avaliações e notas — decidido a partir da sessão,
 * nunca de um identificador do browser. Qualquer outra tentativa é recusada e auditada.
 */
async function exigirDocenteDaDisciplina(
  actor: Principal,
  turmaDisciplinaId: string,
  ip?: string | null,
) {
  if (!can(actor, "notas:lancar")) throw new ErroAutorizacao();
  const td = await db.turmaDisciplina.findUnique({
    where: { id: analisar(uuid, turmaDisciplinaId) },
    include: {
      turma: { include: { anoLectivo: true, classe: true } },
      disciplina: true,
      docente: true,
    },
  });
  if (!td || td.docente?.userId !== actor.id) {
    await registarAuditoria({
      actorId: actor.id,
      acao: "ACESSO_NEGADO",
      entidade: "TurmaDisciplina",
      entidadeId: turmaDisciplinaId,
      depois: { tentativa: "lançar avaliação/notas fora das suas disciplinas" },
      ip,
    });
    throw new ErroAutorizacao("Só pode lançar avaliações e notas nas disciplinas que lecciona.");
  }
  return td;
}

/** As disciplinas que o docente lecciona (com avaliações e períodos do ano). */
export async function minhasDisciplinas(actor: Principal) {
  if (!can(actor, "notas:lancar")) throw new ErroAutorizacao();
  return db.turmaDisciplina.findMany({
    where: { docente: { userId: actor.id }, turma: { archivedAt: null } },
    orderBy: [
      { turma: { anoLectivo: { inicio: "desc" } } },
      { turma: { classe: { ordem: "asc" } } },
      { turma: { nome: "asc" } },
    ],
    include: {
      disciplina: true,
      turma: {
        include: {
          classe: true,
          anoLectivo: { include: { periodos: { orderBy: { ordem: "asc" } } } },
        },
      },
      avaliacoes: {
        orderBy: [{ data: "asc" }],
        include: { periodo: true, _count: { select: { notas: true } } },
      },
    },
  });
}

const avaliacaoSchema = z.object({
  turmaDisciplinaId: uuid,
  periodoId: uuid,
  tipo: z.enum(["TESTE", "TRABALHO", "EXAME", "PARTICIPACAO", "OUTRO"], {
    message: "Tipo de avaliação inválido.",
  }),
  nome: z.string().trim().min(2, "Indique o nome da avaliação.").max(80),
  peso: z.coerce
    .number()
    .int("O peso tem de ser um número inteiro.")
    .min(1, "O peso mínimo é 1.")
    .max(100, "O peso máximo é 100."),
  data: dataSchema,
});

export async function criarAvaliacao(actor: Principal, entrada: unknown, ip?: string | null) {
  const d = analisar(avaliacaoSchema, entrada);
  const td = await exigirDocenteDaDisciplina(actor, d.turmaDisciplinaId, ip);
  if (td.turma.anoLectivo.estado === "FECHADO")
    throw new ErroValidacao(["O ano lectivo está fechado."]);
  const periodo = await db.periodo.findUnique({ where: { id: d.periodoId } });
  if (!periodo || periodo.anoLectivoId !== td.turma.anoLectivoId)
    throw new ErroValidacao(["O período não pertence ao ano lectivo desta turma."]);
  if (d.data < periodo.inicio || d.data > periodo.fim)
    throw new ErroValidacao(["A data da avaliação tem de estar dentro do período."]);

  return comAuditoria(async (tx) => {
    const estado = await bloquearPauta(
      tx,
      { turmaId: td.turmaId, periodoId: periodo.id, anoLectivoId: td.turma.anoLectivoId },
      "partilhado",
    );
    if (estado !== "RASCUNHO") throw new ErroValidacao([MSG_PAUTA_FECHADA]);
    const a = await tx.avaliacao.create({
      data: {
        turmaDisciplinaId: td.id,
        turmaId: td.turmaId,
        anoLectivoId: td.turma.anoLectivoId,
        periodoId: periodo.id,
        tipo: d.tipo,
        nome: d.nome,
        peso: d.peso,
        data: d.data,
        createdById: actor.id,
      },
    });
    return {
      resultado: a.id,
      evento: {
        actorId: actor.id,
        acao: "AVALIACAO_CRIADA",
        entidade: "Avaliacao",
        entidadeId: a.id,
        depois: {
          turmaDisciplinaId: td.id,
          periodoId: periodo.id,
          tipo: d.tipo,
          nome: d.nome,
          peso: d.peso,
        },
        ip,
      },
    };
  });
}

/** Dados para a grelha de lançamento: só o docente da disciplina. Inclui apenas estudantes com matrícula ACTIVA na turma. */
export async function grelhaDeLancamento(
  actor: Principal,
  avaliacaoId: string,
  ip?: string | null,
) {
  const a = await db.avaliacao.findUnique({
    where: { id: analisar(uuid, avaliacaoId) },
    select: { id: true, turmaDisciplinaId: true },
  });
  if (!a) return null;
  const td = await exigirDocenteDaDisciplina(actor, a.turmaDisciplinaId, ip);
  const av = await db.avaliacao.findUniqueOrThrow({
    where: { id: a.id },
    include: { periodo: true },
  });
  const [matriculas, notas, pauta] = await Promise.all([
    db.matricula.findMany({
      where: { turmaId: td.turmaId, estado: "ACTIVA" },
      include: { estudante: true },
      orderBy: { estudante: { nome: "asc" } },
    }),
    db.nota.findMany({ where: { avaliacaoId: a.id } }),
    db.pautaPublicacao.findUnique({
      where: { turmaId_periodoId: { turmaId: td.turmaId, periodoId: av.periodoId } },
    }),
  ]);
  const porEstudante = new Map(notas.map((n) => [n.estudanteId, n.valor]));
  return {
    avaliacao: { id: av.id, nome: av.nome, tipo: av.tipo, peso: av.peso, periodo: av.periodo.nome },
    turma: `${td.turma.classe.nome} ${td.turma.nome}`,
    disciplina: td.disciplina.nome,
    estadoPauta: pauta?.estado ?? "RASCUNHO",
    estudantes: matriculas.map((m) => ({
      id: m.estudanteId,
      nome: m.estudante.nome,
      numeroProcesso: m.estudante.numeroProcesso,
      valor: porEstudante.get(m.estudanteId) ?? null,
    })),
  };
}

const entradaSchema = z
  .array(
    z.object({ estudanteId: uuid, valor: z.union([z.string(), z.number(), z.null()]).optional() }),
  )
  .min(1, "Não há notas para guardar.")
  .max(300, "Demasiadas notas num só envio.");

/**
 * Lança/actualiza notas de UMA avaliação (lote). Tudo numa só transacção:
 *  - o docente tem de ser o da disciplina (sessão); a pauta tem de estar em RASCUNHO (bloqueada FOR SHARE);
 *  - só estudantes com matrícula ACTIVA nessa turma; valor 0–20 até 2 casas (em centésimas);
 *  - valor vazio = não mexe; cada alteração gera auditoria com antes/depois; se algo falhar, nada fica gravado.
 */
export async function lancarNotas(
  actor: Principal,
  avaliacaoId: string,
  entradas: unknown,
  ip?: string | null,
) {
  const lista = analisar(entradaSchema, entradas);
  const av = await db.avaliacao.findUnique({ where: { id: analisar(uuid, avaliacaoId) } });
  if (!av) throw new ErroValidacao(["Avaliação inexistente."]);
  const td = await exigirDocenteDaDisciplina(actor, av.turmaDisciplinaId, ip);

  const valores = new Map<string, number>();
  const erros: string[] = [];
  for (const e of lista) {
    if (e.valor === undefined || e.valor === null || String(e.valor).trim() === "") continue;
    try {
      valores.set(e.estudanteId, notaParaCentesimas(e.valor));
    } catch (x) {
      erros.push((x as Error).message);
    }
  }
  if (erros.length > 0) throw new ErroValidacao([...new Set(erros)]);
  if (valores.size === 0) return { criadas: 0, alteradas: 0 };

  return db.$transaction(
    async (tx) => {
      const estado = await bloquearPauta(
        tx,
        { turmaId: av.turmaId, periodoId: av.periodoId, anoLectivoId: av.anoLectivoId },
        "partilhado",
      );
      if (estado !== "RASCUNHO") throw new ErroValidacao([MSG_PAUTA_FECHADA]);
      const matriculados = new Set(
        (
          await tx.matricula.findMany({
            where: {
              turmaId: td.turmaId,
              estado: "ACTIVA",
              estudanteId: { in: [...valores.keys()] },
            },
            select: { estudanteId: true },
          })
        ).map((m) => m.estudanteId),
      );
      const foraDaTurma = [...valores.keys()].filter((id) => !matriculados.has(id));
      if (foraDaTurma.length > 0)
        throw new ErroValidacao([
          `${foraDaTurma.length} estudante(s) não têm matrícula activa nesta turma.`,
        ]);

      const existentes = new Map(
        (
          await tx.nota.findMany({
            where: { avaliacaoId: av.id, estudanteId: { in: [...valores.keys()] } },
          })
        ).map((n) => [n.estudanteId, n]),
      );
      let criadas = 0;
      let alteradas = 0;
      for (const [estudanteId, valor] of valores) {
        const antes = existentes.get(estudanteId);
        if (antes && antes.valor === valor) continue;
        const nota = await tx.nota.upsert({
          where: { avaliacaoId_estudanteId: { avaliacaoId: av.id, estudanteId } },
          update: { valor, lancadaPorId: actor.id },
          create: { avaliacaoId: av.id, estudanteId, valor, lancadaPorId: actor.id },
        });
        if (antes) alteradas++;
        else criadas++;
        await registarAuditoria(
          {
            actorId: actor.id,
            acao: antes ? "NOTA_ALTERADA" : "NOTA_LANCADA",
            entidade: "Nota",
            entidadeId: nota.id,
            antes: antes ? { valor: antes.valor } : undefined,
            depois: { valor, avaliacaoId: av.id, estudanteId },
            ip,
          },
          tx,
        );
      }
      return { criadas, alteradas };
    },
    { timeout: 30_000 },
  );
}
