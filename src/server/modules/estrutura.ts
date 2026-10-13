import { z } from "zod";
import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { ErroAutorizacao, ErroValidacao, ehViolacaoUnica } from "@/server/erros";
import { dataSchema } from "@/lib/datas";

function exigir(actor: Principal, p: "estrutura:ver" | "estrutura:editar") {
  if (!can(actor, p)) throw new ErroAutorizacao();
}

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

const texto = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const uuid = z.string().uuid("Identificador inválido.");

/** Converte violações de unicidade em mensagens para o utilizador. */
async function comUnicidade<T>(fn: () => Promise<T>, mensagem: string): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (ehViolacaoUnica(e)) throw new ErroValidacao([mensagem]);
    throw e;
  }
}

export async function listarEstrutura(actor: Principal) {
  exigir(actor, "estrutura:ver");
  const [anos, classes, disciplinas, funcionarios, turmas] = await Promise.all([
    db.anoLectivo.findMany({
      orderBy: { inicio: "desc" },
      include: { periodos: { orderBy: { ordem: "asc" } } },
    }),
    db.classe.findMany({ orderBy: { ordem: "asc" } }),
    db.disciplina.findMany({ where: { archivedAt: null }, orderBy: { nome: "asc" } }),
    db.funcionario.findMany({ where: { archivedAt: null }, orderBy: { nome: "asc" } }),
    db.turma.findMany({
      where: { archivedAt: null },
      orderBy: [{ anoLectivo: { inicio: "desc" } }, { classe: { ordem: "asc" } }, { nome: "asc" }],
      include: {
        classe: true,
        anoLectivo: true,
        director: true,
        disciplinas: { include: { disciplina: true, docente: true } },
      },
    }),
  ]);
  return { anos, classes, disciplinas, funcionarios, turmas };
}

// ── Anos lectivos e períodos ─────────────────────────────────────────────────

const anoSchema = z.object({
  nome: texto(3, 40, "Indique o nome do ano lectivo."),
  inicio: dataSchema,
  fim: dataSchema,
});

export async function criarAnoLectivo(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(anoSchema, entrada);
  if (d.fim <= d.inicio)
    throw new ErroValidacao(["A data de fim tem de ser posterior à de início."]);
  const ano = await comUnicidade(
    () => db.anoLectivo.create({ data: { ...d, estado: "PLANEADO" } }),
    "Já existe um ano lectivo com esse nome.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "ANO_LECTIVO_CRIADO",
    entidade: "AnoLectivo",
    entidadeId: ano.id,
    depois: d,
    ip,
  });
  return ano.id;
}

export async function mudarEstadoAnoLectivo(
  actor: Principal,
  id: string,
  estado: "ACTIVO" | "FECHADO",
  ip?: string | null,
) {
  exigir(actor, "estrutura:editar");
  const ano = await db.anoLectivo.findUnique({ where: { id: analisar(uuid, id) } });
  if (!ano) throw new ErroValidacao(["Ano lectivo inexistente."]);
  if (estado === "ACTIVO" && ano.estado !== "PLANEADO")
    throw new ErroValidacao(["Só um ano PLANEADO pode ser activado."]);
  if (estado === "FECHADO" && ano.estado !== "ACTIVO")
    throw new ErroValidacao(["Só um ano ACTIVO pode ser fechado."]);
  await comUnicidade(
    () => db.anoLectivo.update({ where: { id }, data: { estado } }),
    "Já existe um ano lectivo activo. Feche-o antes de activar outro.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "ANO_LECTIVO_ESTADO",
    entidade: "AnoLectivo",
    entidadeId: id,
    antes: { estado: ano.estado },
    depois: { estado },
    ip,
  });
}

const periodoSchema = z.object({
  anoLectivoId: uuid,
  ordem: z.coerce.number().int().min(1).max(12),
  nome: texto(2, 40, "Indique o nome do período."),
  inicio: dataSchema,
  fim: dataSchema,
});

export async function criarPeriodo(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(periodoSchema, entrada);
  const ano = await db.anoLectivo.findUnique({ where: { id: d.anoLectivoId } });
  if (!ano) throw new ErroValidacao(["Ano lectivo inexistente."]);
  if (ano.estado === "FECHADO") throw new ErroValidacao(["O ano lectivo está fechado."]);
  if (d.fim <= d.inicio)
    throw new ErroValidacao(["A data de fim tem de ser posterior à de início."]);
  if (d.inicio < ano.inicio || d.fim > ano.fim)
    throw new ErroValidacao(["O período tem de estar dentro do ano lectivo."]);
  const p = await comUnicidade(
    () => db.periodo.create({ data: d }),
    "Já existe um período com essa ordem neste ano.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "PERIODO_CRIADO",
    entidade: "Periodo",
    entidadeId: p.id,
    depois: d,
    ip,
  });
  return p.id;
}

// ── Classes, disciplinas, turmas ─────────────────────────────────────────────

export async function criarClasse(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(
    z.object({
      nome: texto(2, 40, "Indique o nome da classe."),
      ordem: z.coerce.number().int().min(1).max(20),
    }),
    entrada,
  );
  const c = await comUnicidade(
    () => db.classe.create({ data: d }),
    "Já existe uma classe com esse nome ou ordem.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "CLASSE_CRIADA",
    entidade: "Classe",
    entidadeId: c.id,
    depois: d,
    ip,
  });
  return c.id;
}

export async function criarDisciplina(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(z.object({ nome: texto(2, 80, "Indique o nome da disciplina.") }), entrada);
  const x = await comUnicidade(
    () => db.disciplina.create({ data: d }),
    "Já existe uma disciplina com esse nome.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "DISCIPLINA_CRIADA",
    entidade: "Disciplina",
    entidadeId: x.id,
    depois: d,
    ip,
  });
  return x.id;
}

const turmaSchema = z.object({
  nome: texto(1, 20, "Indique o nome da turma."),
  turno: z.enum(["Manhã", "Tarde", "Noite"], { message: "Turno inválido." }),
  classeId: uuid,
  anoLectivoId: uuid,
  directorId: z.preprocess((v) => (v === "" || v == null ? undefined : v), uuid.optional()),
});

export async function criarTurma(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(turmaSchema, entrada);
  const ano = await db.anoLectivo.findUnique({ where: { id: d.anoLectivoId } });
  if (!ano || ano.estado === "FECHADO")
    throw new ErroValidacao(["Ano lectivo inexistente ou fechado."]);
  if (!(await db.classe.findUnique({ where: { id: d.classeId } })))
    throw new ErroValidacao(["Classe inexistente."]);
  if (d.directorId && !(await db.funcionario.findUnique({ where: { id: d.directorId } })))
    throw new ErroValidacao(["Director de turma inexistente."]);
  const t = await comUnicidade(
    () => db.turma.create({ data: d }),
    "Já existe uma turma com esse nome nesta classe e ano.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "TURMA_CRIADA",
    entidade: "Turma",
    entidadeId: t.id,
    depois: d,
    ip,
  });
  return t.id;
}

// ── Funcionários e docentes ──────────────────────────────────────────────────

const funcionarioSchema = z.object({
  nome: texto(3, 120, "Indique o nome."),
  cargo: texto(2, 80, "Indique o cargo."),
  emailConta: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().toLowerCase().email("Email inválido.").optional(),
  ),
});

export async function criarFuncionario(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(funcionarioSchema, entrada);
  let userId: string | undefined;
  if (d.emailConta) {
    const user = await db.user.findUnique({
      where: { email: d.emailConta },
      include: { papeis: { include: { role: true } } },
    });
    if (!user)
      throw new ErroValidacao([
        "Não existe nenhuma conta com esse email. Peça ao administrador técnico para a criar.",
      ]);
    userId = user.id;
  }
  const f = await comUnicidade(
    () => db.funcionario.create({ data: { nome: d.nome, cargo: d.cargo, userId } }),
    "Essa conta já está associada a outro funcionário.",
  );
  await registarAuditoria({
    actorId: actor.id,
    acao: "FUNCIONARIO_CRIADO",
    entidade: "Funcionario",
    entidadeId: f.id,
    depois: { nome: d.nome, cargo: d.cargo, contaAssociada: Boolean(userId) },
    ip,
  });
  return f.id;
}

const atribuicaoSchema = z.object({ turmaId: uuid, disciplinaId: uuid, docenteId: uuid });

/** Atribui (ou substitui) o docente de uma disciplina numa turma. O docente tem de ter conta com papel DOCENTE. */
export async function atribuirDocente(actor: Principal, entrada: unknown, ip?: string | null) {
  exigir(actor, "estrutura:editar");
  const d = analisar(atribuicaoSchema, entrada);
  const [turma, disciplina, docente] = await Promise.all([
    db.turma.findUnique({ where: { id: d.turmaId }, include: { anoLectivo: true } }),
    db.disciplina.findUnique({ where: { id: d.disciplinaId } }),
    db.funcionario.findUnique({
      where: { id: d.docenteId },
      include: { user: { include: { papeis: { include: { role: true } } } } },
    }),
  ]);
  if (!turma || !disciplina || !docente)
    throw new ErroValidacao(["Turma, disciplina ou docente inexistente."]);
  if (turma.anoLectivo.estado === "FECHADO")
    throw new ErroValidacao(["O ano lectivo está fechado."]);
  if (!docente.user?.papeis.some((p) => p.role.codigo === "DOCENTE")) {
    throw new ErroValidacao([
      "O funcionário tem de ter uma conta com o papel Docente para leccionar.",
    ]);
  }
  const antes = await db.turmaDisciplina.findUnique({
    where: { turmaId_disciplinaId: { turmaId: d.turmaId, disciplinaId: d.disciplinaId } },
  });
  const td = await db.turmaDisciplina.upsert({
    where: { turmaId_disciplinaId: { turmaId: d.turmaId, disciplinaId: d.disciplinaId } },
    update: { docenteId: d.docenteId },
    create: d,
  });
  await registarAuditoria({
    actorId: actor.id,
    acao: "DOCENTE_ATRIBUIDO",
    entidade: "TurmaDisciplina",
    entidadeId: td.id,
    antes: antes ? { docenteId: antes.docenteId } : undefined,
    depois: d,
    ip,
  });
}
