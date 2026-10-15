import { z } from "zod";
import { db } from "@/server/db";
import { comAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { escopoTurmas } from "@/server/authz/scope";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { formatarMedia, mediaPonderada, mediaSimples, notaParaCentesimas } from "@/lib/avaliacao";
import { bloquearPauta } from "./pauta-lock";

const uuid = z.string().uuid("Identificador inválido.");
const motivoSchema = z.string().trim().min(5, "Indique o motivo (mínimo 5 caracteres).").max(300);

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

function exigir(actor: Principal, p: "notas:ver" | "pauta:publicar" | "notas:corrigir") {
  if (!can(actor, p)) throw new ErroAutorizacao();
}

async function carregarAlvo(turmaId: string, periodoId: string) {
  const [turma, periodo] = await Promise.all([
    db.turma.findUnique({
      where: { id: analisar(uuid, turmaId) },
      include: { classe: true, anoLectivo: true },
    }),
    db.periodo.findUnique({ where: { id: analisar(uuid, periodoId) } }),
  ]);
  if (!turma || !periodo || periodo.anoLectivoId !== turma.anoLectivoId)
    throw new ErroValidacao(["Turma ou período inexistente."]);
  return {
    turma,
    periodo,
    alvo: { turmaId: turma.id, periodoId: periodo.id, anoLectivoId: turma.anoLectivoId },
  };
}

// ── Leitura interna ──────────────────────────────────────────────────────────

/** Pautas (turma × período) com avaliações, limitadas ao escopo do utilizador (o Docente só vê as suas turmas). */
export async function listarPautas(actor: Principal) {
  exigir(actor, "notas:ver");
  const avaliacoes = await db.avaliacao.findMany({
    where: { turma: escopoTurmas(actor) },
    distinct: ["turmaId", "periodoId"],
    select: {
      turmaId: true,
      periodoId: true,
      turma: { include: { classe: true, anoLectivo: true } },
      periodo: true,
    },
    orderBy: [{ turma: { anoLectivo: { inicio: "desc" } } }, { periodo: { ordem: "asc" } }],
  });
  const pautas = await db.pautaPublicacao.findMany({
    where: { OR: avaliacoes.map((a) => ({ turmaId: a.turmaId, periodoId: a.periodoId })) },
  });
  const estado = new Map(pautas.map((p) => [`${p.turmaId}:${p.periodoId}`, p.estado]));
  return avaliacoes.map((a) => ({
    turmaId: a.turmaId,
    periodoId: a.periodoId,
    turma: `${a.turma.classe.nome} ${a.turma.nome}`,
    anoLectivo: a.turma.anoLectivo.nome,
    periodo: a.periodo.nome,
    estado: estado.get(`${a.turmaId}:${a.periodoId}`) ?? "RASCUNHO",
  }));
}

/** O que falta lançar: para cada avaliação, estudantes com matrícula ACTIVA sem nota. */
async function notasEmFalta(turmaId: string, periodoId: string) {
  const [matriculas, avaliacoes] = await Promise.all([
    db.matricula.findMany({ where: { turmaId, estado: "ACTIVA" }, select: { estudanteId: true } }),
    db.avaliacao.findMany({
      where: { turmaId, periodoId },
      include: {
        notas: { select: { estudanteId: true } },
        turmaDisciplina: { include: { disciplina: true } },
      },
    }),
  ]);
  const matriculados = new Set(matriculas.map((m) => m.estudanteId));
  return avaliacoes
    .map((a) => ({
      avaliacao: `${a.turmaDisciplina.disciplina.nome} — ${a.nome}`,
      em_falta: [...matriculados].filter((id) => !a.notas.some((n) => n.estudanteId === id)).length,
    }))
    .filter((x) => x.em_falta > 0);
}

/** Pauta completa (estudantes × disciplinas/avaliações + médias). O Docente só recebe as colunas das SUAS disciplinas. */
export async function obterPauta(actor: Principal, turmaId: string, periodoId: string) {
  exigir(actor, "notas:ver");
  if (!uuid.safeParse(turmaId).success || !uuid.safeParse(periodoId).success) return null;
  const turma = await db.turma.findFirst({
    where: { AND: [{ id: turmaId }, escopoTurmas(actor)] },
    include: { classe: true, anoLectivo: true },
  });
  const periodo = await db.periodo.findUnique({ where: { id: periodoId } });
  if (!turma || !periodo || periodo.anoLectivoId !== turma.anoLectivoId) return null;

  const gestao = actor.papeis.some((p) => ["DIRECCAO", "SECRETARIA", "QUALIDADE"].includes(p));
  const soMinhas = gestao ? {} : { turmaDisciplina: { docente: { userId: actor.id } } };
  const [pauta, avaliacoes, matriculas] = await Promise.all([
    db.pautaPublicacao.findUnique({ where: { turmaId_periodoId: { turmaId, periodoId } } }),
    db.avaliacao.findMany({
      where: { turmaId, periodoId, ...soMinhas },
      orderBy: { data: "asc" },
      include: { notas: true, turmaDisciplina: { include: { disciplina: true } } },
    }),
    db.matricula.findMany({
      where: { turmaId, estado: "ACTIVA" },
      include: { estudante: true },
      orderBy: { estudante: { nome: "asc" } },
    }),
  ]);
  const disciplinas = [
    ...new Map(
      avaliacoes.map((a) => [a.turmaDisciplinaId, a.turmaDisciplina.disciplina.nome]),
    ).entries(),
  ].map(([id, nome]) => ({ id, nome }));
  const linhas = matriculas.map((m) => {
    const porDisciplina = disciplinas.map((d) => {
      const itens = avaliacoes
        .filter((a) => a.turmaDisciplinaId === d.id)
        .flatMap((a) => {
          const n = a.notas.find((x) => x.estudanteId === m.estudanteId);
          return n ? [{ valor: n.valor, peso: a.peso }] : [];
        });
      return { disciplinaId: d.id, media: mediaPonderada(itens) };
    });
    const geral = mediaSimples(porDisciplina.flatMap((x) => (x.media === null ? [] : [x.media])));
    return {
      estudanteId: m.estudanteId,
      nome: m.estudante.nome,
      numeroProcesso: m.estudante.numeroProcesso,
      notas: avaliacoes.map((a) => ({
        avaliacaoId: a.id,
        notaId: a.notas.find((x) => x.estudanteId === m.estudanteId)?.id ?? null,
        valor: a.notas.find((x) => x.estudanteId === m.estudanteId)?.valor ?? null,
      })),
      medias: porDisciplina,
      mediaGeral: geral === null ? null : formatarMedia(geral),
    };
  });
  return {
    turmaId,
    periodoId,
    turma: `${turma.classe.nome} ${turma.nome}`,
    anoLectivo: turma.anoLectivo.nome,
    periodo: periodo.nome,
    estado: pauta?.estado ?? "RASCUNHO",
    validadaEm: pauta?.validadaEm ?? null,
    publicadaEm: pauta?.publicadaEm ?? null,
    disciplinas,
    avaliacoes: avaliacoes.map((a) => ({
      id: a.id,
      turmaDisciplinaId: a.turmaDisciplinaId,
      nome: a.nome,
      tipo: a.tipo,
      peso: a.peso,
    })),
    linhas: linhas.map((l) => ({
      ...l,
      medias: l.medias.map((m) => ({
        disciplinaId: m.disciplinaId,
        media: m.media === null ? null : formatarMedia(m.media),
      })),
    })),
    emFalta: await notasEmFalta(turmaId, periodoId),
  };
}

// ── Transições (só Direcção) ─────────────────────────────────────────────────

/** RASCUNHO → VALIDADA. Exige ≥1 avaliação e TODAS as notas lançadas. Bloqueia a pauta (FOR UPDATE) para não se cruzar com lançamentos. */
export async function validarPauta(
  actor: Principal,
  turmaId: string,
  periodoId: string,
  ip?: string | null,
) {
  exigir(actor, "pauta:publicar");
  const { alvo } = await carregarAlvo(turmaId, periodoId);
  await comAuditoria(async (tx) => {
    const estado = await bloquearPauta(tx, alvo, "exclusivo");
    if (estado !== "RASCUNHO")
      throw new ErroValidacao([`A pauta está ${estado}: só se valida uma pauta em rascunho.`]);
    const avaliacoes = await tx.avaliacao.findMany({
      where: { turmaId, periodoId },
      include: { notas: { select: { estudanteId: true } } },
    });
    if (avaliacoes.length === 0) throw new ErroValidacao(["Não há avaliações neste período."]);
    const matriculados = (
      await tx.matricula.findMany({
        where: { turmaId, estado: "ACTIVA" },
        select: { estudanteId: true },
      })
    ).map((m) => m.estudanteId);
    if (matriculados.length === 0)
      throw new ErroValidacao(["A turma não tem estudantes com matrícula activa."]);
    const faltam = avaliacoes.reduce(
      (t, a) => t + matriculados.filter((id) => !a.notas.some((n) => n.estudanteId === id)).length,
      0,
    );
    if (faltam > 0)
      throw new ErroValidacao([
        `Faltam ${faltam} nota(s) por lançar. Complete todas as notas antes de validar.`,
      ]);
    await tx.pautaPublicacao.update({
      where: { turmaId_periodoId: { turmaId, periodoId } },
      data: { estado: "VALIDADA", validadaPorId: actor.id, validadaEm: new Date() },
    });
    return {
      resultado: undefined,
      evento: {
        actorId: actor.id,
        acao: "PAUTA_VALIDADA",
        entidade: "PautaPublicacao",
        entidadeId: `${turmaId}:${periodoId}`,
        antes: { estado: "RASCUNHO" },
        depois: {
          estado: "VALIDADA",
          avaliacoes: avaliacoes.length,
          estudantes: matriculados.length,
        },
        ip,
      },
    };
  });
}

/** VALIDADA → PUBLICADA: a partir daqui os portais passam a ver as notas. */
export async function publicarPauta(
  actor: Principal,
  turmaId: string,
  periodoId: string,
  ip?: string | null,
) {
  exigir(actor, "pauta:publicar");
  const { alvo } = await carregarAlvo(turmaId, periodoId);
  await comAuditoria(async (tx) => {
    const estado = await bloquearPauta(tx, alvo, "exclusivo");
    if (estado !== "VALIDADA")
      throw new ErroValidacao([`A pauta está ${estado}: só se publica uma pauta validada.`]);
    await tx.pautaPublicacao.update({
      where: { turmaId_periodoId: { turmaId, periodoId } },
      data: { estado: "PUBLICADA", publicadaPorId: actor.id, publicadaEm: new Date() },
    });
    return {
      resultado: undefined,
      evento: {
        actorId: actor.id,
        acao: "PAUTA_PUBLICADA",
        entidade: "PautaPublicacao",
        entidadeId: `${turmaId}:${periodoId}`,
        antes: { estado: "VALIDADA" },
        depois: { estado: "PUBLICADA" },
        ip,
      },
    };
  });
}

/** VALIDADA → RASCUNHO (com motivo): reabre para o docente corrigir antes de publicar. Uma pauta PUBLICADA não se reabre. */
export async function reabrirPauta(
  actor: Principal,
  turmaId: string,
  periodoId: string,
  motivo: string,
  ip?: string | null,
) {
  exigir(actor, "pauta:publicar");
  const m = analisar(motivoSchema, motivo);
  const { alvo } = await carregarAlvo(turmaId, periodoId);
  await comAuditoria(async (tx) => {
    const estado = await bloquearPauta(tx, alvo, "exclusivo");
    if (estado !== "VALIDADA")
      throw new ErroValidacao([
        estado === "PUBLICADA"
          ? "Uma pauta publicada não se reabre: corrija nota a nota, com motivo."
          : "A pauta já está em rascunho.",
      ]);
    await tx.pautaPublicacao.update({
      where: { turmaId_periodoId: { turmaId, periodoId } },
      data: { estado: "RASCUNHO", validadaPorId: null, validadaEm: null },
    });
    return {
      resultado: undefined,
      evento: {
        actorId: actor.id,
        acao: "PAUTA_REABERTA",
        entidade: "PautaPublicacao",
        entidadeId: `${turmaId}:${periodoId}`,
        antes: { estado: "VALIDADA" },
        depois: { estado: "RASCUNHO", motivo: m },
        ip,
      },
    };
  });
}

/**
 * Corrige UMA nota de uma pauta já PUBLICADA — só a Direcção, com motivo obrigatório.
 * A alteração faz-se pela função privilegiada `corrigir_nota_publicada` da base de dados (única via permitida ao papel da
 * aplicação): ela própria valida (pauta publicada, valor, motivo) e regista a auditoria antes/depois na MESMA transacção.
 * Não existe nenhuma variável de sessão que desbloqueie notas: um acesso directo por SQL continua a ser recusado.
 */
export async function corrigirNota(
  actor: Principal,
  notaId: string,
  novoValor: string | number,
  motivo: string,
  ip?: string | null,
) {
  exigir(actor, "notas:corrigir");
  const m = analisar(motivoSchema, motivo);
  let valor: number;
  try {
    valor = notaParaCentesimas(novoValor);
  } catch (e) {
    throw new ErroValidacao([(e as Error).message]);
  }
  const nota = await db.nota.findUnique({
    where: { id: analisar(uuid, notaId) },
    include: { avaliacao: true },
  });
  if (!nota) throw new ErroValidacao(["Nota inexistente."]);
  const { avaliacao: a } = nota;
  await db.$transaction(async (tx) => {
    // Mensagens claras para os casos normais; a função da BD repete e impõe todas estas regras.
    const estado = await bloquearPauta(
      tx,
      { turmaId: a.turmaId, periodoId: a.periodoId, anoLectivoId: a.anoLectivoId },
      "exclusivo",
    );
    if (estado !== "PUBLICADA")
      throw new ErroValidacao([
        estado === "RASCUNHO"
          ? "A pauta está em rascunho: o docente pode alterar a nota directamente."
          : "A pauta está validada: reabra-a para corrigir (ou publique-a e corrija com motivo).",
      ]);
    const actual = await tx.nota.findUniqueOrThrow({ where: { id: nota.id } });
    if (actual.valor === valor) throw new ErroValidacao(["O valor é igual ao actual."]);
    await tx.$executeRaw`SELECT corrigir_nota_publicada(${nota.id}::uuid, ${valor}::int, ${actor.id}::uuid, ${m}, ${ip ?? null})`;
  });
}
