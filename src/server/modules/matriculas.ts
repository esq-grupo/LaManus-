import { z } from "zod";
import { db } from "@/server/db";
import { registarAuditoria } from "@/server/audit";
import { can, type Principal } from "@/server/authz";
import { ErroAutorizacao, ErroValidacao, ehViolacaoUnica } from "@/server/erros";

const uuid = z.string().uuid("Identificador inválido.");

function exigirEditar(actor: Principal) {
  if (!can(actor, "estudantes:editar")) throw new ErroAutorizacao();
}

function analisar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const r = schema.safeParse(entrada);
  if (!r.success) throw new ErroValidacao(r.error.issues.map((i) => i.message));
  return r.data;
}

const MSG_DUPLICADA = "O estudante já tem uma matrícula activa neste ano lectivo.";
const MSG_NOVA_REPETIDA =
  "O estudante já tem matrícula inicial («Nova»). Para outro ano use «Renovação».";

/** Traduz a violação do índice único para a mensagem certa (cada índice protege uma regra diferente). */
function mensagemDeUnicidade(e: unknown): string {
  const texto = `${(e as { message?: string }).message ?? ""} ${JSON.stringify((e as { meta?: unknown }).meta ?? {})}`;
  return texto.includes("uma_nova_por_estudante") ? MSG_NOVA_REPETIDA : MSG_DUPLICADA;
}

const matricularSchema = z.object({
  estudanteId: uuid,
  turmaId: uuid,
  tipo: z.enum(["NOVA", "RENOVACAO"], { message: "Tipo de matrícula inválido." }),
});

/**
 * Matrícula nova ou renovação. As regras de unicidade (uma activa por estudante e ano; uma «Nova» por estudante)
 * são garantidas pela BASE DE DADOS (índices parciais), por isso valem mesmo com pedidos simultâneos.
 * A matrícula e a sua auditoria gravam-se na MESMA transacção.
 */
export async function matricular(actor: Principal, entrada: unknown, ip?: string | null) {
  exigirEditar(actor);
  const d = analisar(matricularSchema, entrada);
  const [estudante, turma] = await Promise.all([
    db.estudante.findUnique({ where: { id: d.estudanteId }, include: { matriculas: true } }),
    db.turma.findUnique({ where: { id: d.turmaId }, include: { anoLectivo: true } }),
  ]);
  if (!estudante || estudante.archivedAt) throw new ErroValidacao(["Estudante inexistente."]);
  if (!turma || turma.archivedAt) throw new ErroValidacao(["Turma inexistente."]);
  if (estudante.estado !== "ACTIVO") throw new ErroValidacao(["O estudante está inactivo."]);
  if (turma.anoLectivo.estado === "FECHADO")
    throw new ErroValidacao(["O ano lectivo da turma está fechado."]);

  // Verificações amigáveis (mensagens claras); a garantia real é o índice da BD, que decide em caso de corrida.
  const jaTeveMatricula = estudante.matriculas.some((m) => m.estado !== "ANULADA");
  if (d.tipo === "NOVA" && jaTeveMatricula) throw new ErroValidacao([MSG_NOVA_REPETIDA]);
  if (d.tipo === "RENOVACAO" && !jaTeveMatricula)
    throw new ErroValidacao(["Este estudante não tem matrículas anteriores: use «Nova»."]);

  try {
    return await db.$transaction(async (tx) => {
      const m = await tx.matricula.create({
        data: {
          estudanteId: d.estudanteId,
          turmaId: d.turmaId,
          anoLectivoId: turma.anoLectivoId,
          tipo: d.tipo,
          createdById: actor.id,
        },
      });
      await registarAuditoria(
        {
          actorId: actor.id,
          acao: "MATRICULA_CRIADA",
          entidade: "Matricula",
          entidadeId: m.id,
          depois: {
            estudanteId: d.estudanteId,
            turmaId: d.turmaId,
            anoLectivoId: turma.anoLectivoId,
            tipo: d.tipo,
          },
          ip,
        },
        tx,
      );
      return m.id;
    });
  } catch (e) {
    if (ehViolacaoUnica(e)) throw new ErroValidacao([mensagemDeUnicidade(e)]);
    throw e;
  }
}

const transferirSchema = z.object({
  matriculaId: uuid,
  novaTurmaId: uuid,
  motivo: z.string().trim().min(5, "Indique o motivo da transferência.").max(300),
});

/**
 * Transferência de turma (mesmo ano lectivo): fecha a matrícula actual como TRANSFERIDA e abre outra, com motivo.
 * A alteração e a auditoria gravam-se na mesma transacção: se a auditoria falhar, a transferência não fica gravada.
 */
export async function transferirTurma(actor: Principal, entrada: unknown, ip?: string | null) {
  exigirEditar(actor);
  const d = analisar(transferirSchema, entrada);
  const antiga = await db.matricula.findUnique({ where: { id: d.matriculaId } });
  if (!antiga || antiga.estado !== "ACTIVA")
    throw new ErroValidacao(["Só se transfere uma matrícula activa."]);
  const nova = await db.turma.findUnique({ where: { id: d.novaTurmaId } });
  if (!nova || nova.archivedAt) throw new ErroValidacao(["Turma de destino inexistente."]);
  if (nova.id === antiga.turmaId) throw new ErroValidacao(["A turma de destino é a mesma."]);
  if (nova.anoLectivoId !== antiga.anoLectivoId)
    throw new ErroValidacao(["A transferência só é possível dentro do mesmo ano lectivo."]);

  return db.$transaction(async (tx) => {
    // Fechar primeiro: o índice parcial só admite uma ACTIVA por estudante/ano.
    const fechada = await tx.matricula.updateMany({
      where: { id: antiga.id, estado: "ACTIVA" },
      data: { estado: "TRANSFERIDA" },
    });
    if (fechada.count !== 1)
      throw new ErroValidacao(["A matrícula já foi alterada por outra operação."]);
    const criada = await tx.matricula.create({
      data: {
        estudanteId: antiga.estudanteId,
        turmaId: nova.id,
        anoLectivoId: antiga.anoLectivoId,
        tipo: antiga.tipo,
        createdById: actor.id,
      },
    });
    await registarAuditoria(
      {
        actorId: actor.id,
        acao: "MATRICULA_TRANSFERIDA",
        entidade: "Matricula",
        entidadeId: criada.id,
        antes: { matriculaId: antiga.id, turmaId: antiga.turmaId },
        depois: { turmaId: nova.id, motivo: d.motivo },
        ip,
      },
      tx,
    );
    return criada.id;
  });
}

export async function anularMatricula(
  actor: Principal,
  matriculaId: string,
  motivo: string,
  ip?: string | null,
) {
  exigirEditar(actor);
  const m = analisar(z.string().trim().min(5, "Indique o motivo da anulação.").max(300), motivo);
  const id = analisar(uuid, matriculaId);
  await db.$transaction(async (tx) => {
    const anulada = await tx.matricula.updateMany({
      where: { id, estado: "ACTIVA" },
      data: { estado: "ANULADA" },
    });
    if (anulada.count !== 1) throw new ErroValidacao(["Só se anula uma matrícula activa."]);
    await registarAuditoria(
      {
        actorId: actor.id,
        acao: "MATRICULA_ANULADA",
        entidade: "Matricula",
        entidadeId: id,
        antes: { estado: "ACTIVA" },
        depois: { estado: "ANULADA", motivo: m },
        ip,
      },
      tx,
    );
  });
}
