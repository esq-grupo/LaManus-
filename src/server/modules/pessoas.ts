import { z } from "zod";
import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { escopoEstudantes } from "@/server/authz/scope";
import { ErroAutorizacao, ErroValidacao, ehViolacaoUnica } from "@/server/erros";
import { dataSchema } from "@/lib/datas";
import { mascararBi, normalizarBi } from "@/lib/mascarar";

function exigir(actor: Principal, p: "estudantes:ver" | "estudantes:editar") {
  if (!can(actor, p)) throw new ErroAutorizacao();
}

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

const uuid = z.string().uuid("Identificador inválido.");
const opcional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), s.optional());
const biSchema = opcional(
  z.string().trim().min(5, "BI/cédula inválido.").max(30, "BI/cédula inválido."),
);

/** Só quem pode editar vê o BI completo; os restantes vêem-no mascarado. */
const bi = (actor: Principal, valor: string | null) =>
  can(actor, "estudantes:editar") ? valor : mascararBi(valor);
/** O BI nunca vai completo para a auditoria. */
const paraAuditoria = <T extends { bi?: string | null }>(o: T) => ({
  ...o,
  bi: mascararBi(o.bi ?? null),
});

// ── Estudantes ───────────────────────────────────────────────────────────────

const estudanteSchema = z.object({
  numeroProcesso: z.string().trim().min(1, "Indique o n.º de processo.").max(30),
  nome: z.string().trim().min(3, "Indique o nome completo.").max(160),
  dataNascimento: dataSchema,
  bi: biSchema,
  contacto: opcional(z.string().trim().max(60)),
});

export async function criarEstudante(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estudantes:editar");
  const d = analisar(estudanteSchema, entrada);
  if (d.dataNascimento > new Date())
    throw new ErroValidacao(["A data de nascimento não pode ser futura."]);
  const dados = { ...d, bi: normalizarBi(d.bi) };
  try {
    const e = await db.estudante.create({ data: dados });
    await registarAuditoria({
      actorId: actor.id,
      acao: "ESTUDANTE_CRIADO",
      entidade: "Estudante",
      entidadeId: e.id,
      depois: paraAuditoria(dados),
      ip,
    });
    return e.id;
  } catch (e) {
    if (ehViolacaoUnica(e))
      throw new ErroValidacao(["Já existe um estudante com esse n.º de processo ou BI."]);
    throw e;
  }
}

export async function actualizarEstudante(
  actor: Principal,
  id: string,
  entrada: unknown,
  ip?: string | null,
) {
  exigir(actor, "estudantes:editar");
  const d = analisar(
    estudanteSchema
      .omit({ numeroProcesso: true })
      .extend({ estado: z.enum(["ACTIVO", "INACTIVO"]) }),
    entrada,
  );
  const antes = await db.estudante.findUnique({ where: { id: analisar(uuid, id) } });
  if (!antes) throw new ErroValidacao(["Estudante inexistente."]);
  const dados = { ...d, bi: normalizarBi(d.bi) };
  try {
    await db.estudante.update({ where: { id }, data: dados });
  } catch (e) {
    if (ehViolacaoUnica(e)) throw new ErroValidacao(["Já existe um estudante com esse BI."]);
    throw e;
  }
  await registarAuditoria({
    actorId: actor.id,
    acao: "ESTUDANTE_ACTUALIZADO",
    entidade: "Estudante",
    entidadeId: id,
    antes: paraAuditoria({
      nome: antes.nome,
      bi: antes.bi,
      contacto: antes.contacto,
      estado: antes.estado,
    }),
    depois: paraAuditoria({
      nome: dados.nome,
      bi: dados.bi,
      contacto: dados.contacto ?? null,
      estado: dados.estado,
    }),
    ip,
  });
}

/** Pesquisa por nome, n.º de processo ou BI — SEMPRE limitada ao escopo do utilizador. */
export async function pesquisarEstudantes(actor: Principal, termo = "", limite = 50) {
  exigir(actor, "estudantes:ver");
  const t = termo.trim().slice(0, 80);
  const filtroTermo = t
    ? {
        OR: [
          { nome: { contains: t, mode: "insensitive" as const } },
          { numeroProcesso: { contains: t, mode: "insensitive" as const } },
          { bi: { contains: t.replace(/\s+/g, "").toUpperCase() } },
        ],
      }
    : {};
  const lista = await db.estudante.findMany({
    where: { AND: [escopoEstudantes(actor), filtroTermo, { archivedAt: null }] },
    orderBy: { nome: "asc" },
    take: Math.min(limite, 100),
    include: {
      matriculas: {
        where: { estado: "ACTIVA" },
        include: { turma: { include: { classe: true } } },
      },
    },
  });
  return lista.map((e) => ({
    id: e.id,
    numeroProcesso: e.numeroProcesso,
    nome: e.nome,
    bi: bi(actor, e.bi),
    estado: e.estado,
    turmas: e.matriculas.map((m) => `${m.turma.classe.nome} ${m.turma.nome}`),
  }));
}

/** Devolve `null` se o estudante não existir OU estiver fora do escopo (o chamador responde 404, sem revelar qual). */
export async function obterEstudante(actor: Principal, id: string) {
  exigir(actor, "estudantes:ver");
  if (!uuid.safeParse(id).success) return null;
  const e = await db.estudante.findFirst({
    where: { AND: [{ id }, escopoEstudantes(actor), { archivedAt: null }] },
    include: {
      matriculas: {
        orderBy: { data: "desc" },
        include: { turma: { include: { classe: true, anoLectivo: true } } },
      },
      encarregados: { include: { encarregado: true } },
    },
  });
  if (!e) return null;
  // Estudantes e encarregados não vêem dados de outros encarregados (nem contactos).
  const verEncarregados =
    can(actor, "estudantes:editar") ||
    actor.papeis.some((p) => ["FINANCEIRO", "QUALIDADE", "DOCENTE"].includes(p));
  return {
    id: e.id,
    numeroProcesso: e.numeroProcesso,
    nome: e.nome,
    dataNascimento: e.dataNascimento,
    bi: bi(actor, e.bi),
    contacto: can(actor, "estudantes:editar") ? e.contacto : null,
    estado: e.estado,
    matriculas: e.matriculas.map((m) => ({
      id: m.id,
      estado: m.estado,
      tipo: m.tipo,
      data: m.data,
      turma: `${m.turma.classe.nome} ${m.turma.nome}`,
      anoLectivo: m.turma.anoLectivo.nome,
    })),
    encarregados: verEncarregados
      ? e.encarregados.map((l) => ({
          encarregadoId: l.encarregadoId,
          nome: l.encarregado.nome,
          bi: bi(actor, l.encarregado.bi),
          contacto: can(actor, "estudantes:editar") ? l.encarregado.contacto : null,
          parentesco: l.parentesco,
          verificado: l.verificado,
          autorizacaoActiva: l.autorizacaoActiva,
          principal: l.principal,
          validoAte: l.validoAte,
        }))
      : [],
  };
}

/** Educandos que o utilizador pode ver no portal (estudante: ele próprio; encarregado: só verificados e activos). */
export async function meusEducandos(actor: Principal) {
  exigir(actor, "estudantes:ver");
  const lista = await db.estudante.findMany({
    where: { AND: [escopoEstudantes(actor), { archivedAt: null }] },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, numeroProcesso: true },
  });
  return lista;
}

// ── Encarregados e ligações ──────────────────────────────────────────────────

const PARENTESCOS = [
  "Pai",
  "Mãe",
  "Avô/Avó",
  "Tio/Tia",
  "Irmão/Irmã",
  "Tutor legal",
  "Outro",
] as const;

const ligarSchema = z.object({
  estudanteId: uuid,
  nome: z.string().trim().min(3, "Indique o nome do encarregado.").max(160),
  bi: biSchema,
  contacto: opcional(z.string().trim().max(60)),
  parentesco: z.enum(PARENTESCOS, { message: "Parentesco inválido." }),
  principal: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()),
});

/**
 * Cria o encarregado (ou reutiliza o que tem o mesmo BI — um encarregado com vários educandos, D8)
 * e liga-o ao estudante. A ligação nasce NÃO verificada: o encarregado não vê nada até ser verificada.
 */
export async function ligarEncarregado(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estudantes:editar");
  const d = analisar(ligarSchema, entrada);
  const biNorm = normalizarBi(d.bi);
  if (!(await db.estudante.findUnique({ where: { id: d.estudanteId } })))
    throw new ErroValidacao(["Estudante inexistente."]);

  const resultado = await db.$transaction(async (tx) => {
    let enc = biNorm ? await tx.encarregado.findUnique({ where: { bi: biNorm } }) : null;
    enc ??= await tx.encarregado.create({
      data: { nome: d.nome, bi: biNorm, contacto: d.contacto },
    });
    const existente = await tx.estudanteEncarregado.findUnique({
      where: { estudanteId_encarregadoId: { estudanteId: d.estudanteId, encarregadoId: enc.id } },
    });
    if (existente) throw new ErroValidacao(["Este encarregado já está ligado a este estudante."]);
    if (d.principal) {
      await tx.estudanteEncarregado.updateMany({
        where: { estudanteId: d.estudanteId, principal: true },
        data: { principal: false },
      });
    }
    await tx.estudanteEncarregado.create({
      data: {
        estudanteId: d.estudanteId,
        encarregadoId: enc.id,
        parentesco: d.parentesco,
        principal: d.principal,
        verificado: false,
        autorizacaoActiva: true,
      },
    });
    return enc.id;
  });
  await registarAuditoria({
    actorId: actor.id,
    acao: "ENCARREGADO_LIGADO",
    entidade: "EstudanteEncarregado",
    entidadeId: `${d.estudanteId}:${resultado}`,
    depois: {
      estudanteId: d.estudanteId,
      encarregadoId: resultado,
      parentesco: d.parentesco,
      verificado: false,
    },
    ip,
  });
  return resultado;
}

async function ligacao(estudanteId: string, encarregadoId: string) {
  const l = await db.estudanteEncarregado.findUnique({
    where: {
      estudanteId_encarregadoId: {
        estudanteId: analisar(uuid, estudanteId),
        encarregadoId: analisar(uuid, encarregadoId),
      },
    },
  });
  if (!l) throw new ErroValidacao(["Ligação inexistente."]);
  return l;
}

/** Verificação documental da ligação (apresentou BI/documento). Só depois o encarregado passa a ver o educando. */
export async function verificarLigacao(
  actor: Principal,
  estudanteId: string,
  encarregadoId: string,
  ip?: string | null,
) {
  exigir(actor, "estudantes:editar");
  const l = await ligacao(estudanteId, encarregadoId);
  if (l.verificado) return;
  await db.estudanteEncarregado.update({
    where: { estudanteId_encarregadoId: { estudanteId, encarregadoId } },
    data: { verificado: true, verificadoPorId: actor.id, verificadoEm: new Date() },
  });
  await registarAuditoria({
    actorId: actor.id,
    acao: "LIGACAO_VERIFICADA",
    entidade: "EstudanteEncarregado",
    entidadeId: `${estudanteId}:${encarregadoId}`,
    antes: { verificado: false },
    depois: { verificado: true },
    ip,
  });
}

/** Revoga/repõe a autorização (ex.: decisão judicial, pedido do outro progenitor). Efeito imediato nos portais. */
export async function definirAutorizacao(
  actor: Principal,
  estudanteId: string,
  encarregadoId: string,
  activa: boolean,
  ip?: string | null,
) {
  exigir(actor, "estudantes:editar");
  const l = await ligacao(estudanteId, encarregadoId);
  if (l.autorizacaoActiva === activa) return;
  await db.estudanteEncarregado.update({
    where: { estudanteId_encarregadoId: { estudanteId, encarregadoId } },
    data: { autorizacaoActiva: activa },
  });
  await registarAuditoria({
    actorId: actor.id,
    acao: activa ? "AUTORIZACAO_REPOSTA" : "AUTORIZACAO_REVOGADA",
    entidade: "EstudanteEncarregado",
    entidadeId: `${estudanteId}:${encarregadoId}`,
    antes: { autorizacaoActiva: l.autorizacaoActiva },
    depois: { autorizacaoActiva: activa },
    ip,
  });
}

/** Associa a conta de utilizador (já criada pelo administrador técnico) ao encarregado ou ao estudante. */
export async function associarConta(
  actor: Principal,
  alvo: { tipo: "encarregado" | "estudante"; id: string },
  email: string,
  ip?: string | null,
) {
  exigir(actor, "estudantes:editar");
  const papel = alvo.tipo === "encarregado" ? "ENCARREGADO" : "ESTUDANTE";
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { papeis: { include: { role: true } } },
  });
  if (!user || !user.papeis.some((p) => p.role.codigo === papel)) {
    throw new ErroValidacao([
      `Não existe uma conta com o papel ${alvo.tipo === "encarregado" ? "Encarregado" : "Estudante"} com esse email.`,
    ]);
  }
  try {
    if (alvo.tipo === "encarregado")
      await db.encarregado.update({
        where: { id: analisar(uuid, alvo.id) },
        data: { userId: user.id },
      });
    else
      await db.estudante.update({
        where: { id: analisar(uuid, alvo.id) },
        data: { userId: user.id },
      });
  } catch (e) {
    if (ehViolacaoUnica(e))
      throw new ErroValidacao(["Essa conta já está associada a outra pessoa."]);
    throw e;
  }
  await registarAuditoria({
    actorId: actor.id,
    acao: "CONTA_ASSOCIADA",
    entidade: alvo.tipo === "encarregado" ? "Encarregado" : "Estudante",
    entidadeId: alvo.id,
    depois: { userId: user.id },
    ip,
  });
}
