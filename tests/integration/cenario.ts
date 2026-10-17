import { randomUUID } from "node:crypto";
import type { Principal, Papel } from "@/server/authz";
import { db, dbAdmin, criarUser, limparUser } from "./ajuda";

/** Dados isolados por teste (nomes únicos) e limpeza completa no fim. */
export class Cenario {
  utilizadores: string[] = [];
  anos: string[] = [];
  classes: string[] = [];
  disciplinas: string[] = [];
  funcionarios: string[] = [];
  estudantes: string[] = [];
  encarregados: string[] = [];
  tiposEncargo: string[] = [];
  sufixo = randomUUID().slice(0, 8);

  async principal(...papeis: Papel[]): Promise<Principal & { email: string }> {
    const u = await criarUser(papeis);
    this.utilizadores.push(u.id);
    return { id: u.id, papeis: u.papeis, email: u.email };
  }

  async ano(estado: "PLANEADO" | "FECHADO" = "PLANEADO", deslocacaoAnos = 0) {
    const base = 2100 + Math.floor(Math.random() * 800) + deslocacaoAnos;
    const ano = await db.anoLectivo.create({
      data: {
        nome: `T-${this.sufixo}-${base}-${Math.random().toString(36).slice(2, 6)}`,
        inicio: new Date(`${base}-09-01`),
        fim: new Date(`${base + 1}-07-15`),
        estado,
      },
    });
    this.anos.push(ano.id);
    return ano;
  }

  async classe() {
    const c = await db.classe.create({
      data: {
        nome: `C-${this.sufixo}-${Math.random().toString(36).slice(2, 6)}`,
        ordem: 100 + Math.floor(Math.random() * 100000),
      },
    });
    this.classes.push(c.id);
    return c;
  }

  async turma(anoLectivoId: string, classeId: string, nome = "A") {
    return db.turma.create({ data: { nome, turno: "Manhã", classeId, anoLectivoId } });
  }

  async disciplina() {
    const d = await db.disciplina.create({
      data: { nome: `D-${this.sufixo}-${Math.random().toString(36).slice(2, 6)}` },
    });
    this.disciplinas.push(d.id);
    return d;
  }

  async funcionario(userId?: string) {
    const f = await db.funcionario.create({
      data: { nome: "Docente Teste", cargo: "Docente", userId },
    });
    this.funcionarios.push(f.id);
    return f;
  }

  async estudante(extra: { userId?: string; bi?: string } = {}) {
    const e = await db.estudante.create({
      data: {
        numeroProcesso: `T-${this.sufixo}-${Math.random().toString(36).slice(2, 8)}`,
        nome: "Estudante de Teste",
        dataNascimento: new Date("2012-05-10"),
        ...extra,
      },
    });
    this.estudantes.push(e.id);
    return e;
  }

  async encarregado(userId?: string) {
    const e = await db.encarregado.create({ data: { nome: "Encarregado de Teste", userId } });
    this.encarregados.push(e.id);
    return e;
  }

  async ligar(
    estudanteId: string,
    encarregadoId: string,
    extra: Partial<{
      verificado: boolean;
      autorizacaoActiva: boolean;
      validoAte: Date;
      validoDe: Date;
    }> = {},
  ) {
    return db.estudanteEncarregado.create({
      data: { estudanteId, encarregadoId, parentesco: "Pai", ...extra },
    });
  }

  periodos: string[] = [];

  /** Três períodos dentro do ano (1.º: Set–Dez; 2.º: Jan–Abr; 3.º: Abr–Jul). */
  async periodosDoAno(ano: { id: string; inicio: Date }) {
    const y = ano.inicio.getUTCFullYear();
    const defs = [
      ["1.º período", `${y}-09-01`, `${y}-12-15`],
      ["2.º período", `${y + 1}-01-10`, `${y + 1}-04-10`],
      ["3.º período", `${y + 1}-04-20`, `${y + 1}-07-10`],
    ] as const;
    const out = [];
    for (const [i, [nome, ini, fim]] of defs.entries()) {
      const p = await db.periodo.create({
        data: {
          anoLectivoId: ano.id,
          ordem: i + 1,
          nome,
          inicio: new Date(ini),
          fim: new Date(fim),
        },
      });
      this.periodos.push(p.id);
      out.push(p);
    }
    return out as [(typeof out)[number], (typeof out)[number], (typeof out)[number]];
  }

  async matricular(estudanteId: string, turmaId: string, anoLectivoId: string) {
    return db.matricula.create({ data: { estudanteId, turmaId, anoLectivoId, tipo: "NOVA" } });
  }

  /** Tipo de encargo (nome único por teste). */
  async tipoEncargo(
    valorReferencia = 5_000_000n,
    periodicidade: "MENSAL" | "ANUAL" | "UNICO" = "MENSAL",
  ) {
    const t = await db.tipoEncargo.create({
      data: {
        nome: `TE-${this.sufixo}-${Math.random().toString(36).slice(2, 6)}`,
        valorReferencia,
        periodicidade,
      },
    });
    this.tiposEncargo.push(t.id);
    return t;
  }

  async limpar() {
    // Livro financeiro: só o DONO apaga (gatilhos). Ordem: dependentes primeiro.
    const ests = { in: this.estudantes };
    await dbAdmin.$transaction(async (tx) => {
      await tx.recibo.deleteMany({ where: { estudanteId: ests } });
      await tx.estornoAlocacao.deleteMany({
        where: { estorno: { pagamento: { estudanteId: ests } } },
      });
      await tx.estorno.deleteMany({ where: { pagamento: { estudanteId: ests } } });
      await tx.alocacaoPagamento.deleteMany({ where: { estudanteId: ests } });
      await tx.pagamento.deleteMany({ where: { estudanteId: ests } });
      await tx.encargo.deleteMany({
        where: { OR: [{ estudanteId: ests }, { anoLectivoId: { in: this.anos } }] },
      });
      await tx.tipoEncargo.deleteMany({ where: { id: { in: this.tiposEncargo } } });
    });
    // As notas/avaliações/pautas são protegidas por gatilhos que só o DONO das tabelas pode contornar: a limpeza usa a ligação de administração.
    await dbAdmin.$transaction(async (tx) => {
      await await tx.nota.deleteMany({
        where: {
          OR: [
            { estudanteId: { in: this.estudantes } },
            { avaliacao: { anoLectivoId: { in: this.anos } } },
          ],
        },
      });
      await tx.avaliacao.deleteMany({ where: { anoLectivoId: { in: this.anos } } });
      await tx.pautaPublicacao.deleteMany({ where: { anoLectivoId: { in: this.anos } } });
    });
    await dbAdmin.eventoAuditoria
      .deleteMany({ where: { actorId: { in: this.utilizadores } } })
      .catch(() => undefined);
    await dbAdmin.matricula.deleteMany({
      where: {
        OR: [{ estudanteId: { in: this.estudantes } }, { anoLectivoId: { in: this.anos } }],
      },
    });
    await dbAdmin.estudanteEncarregado.deleteMany({
      where: {
        OR: [
          { estudanteId: { in: this.estudantes } },
          { encarregadoId: { in: this.encarregados } },
        ],
      },
    });
    await dbAdmin.turmaDisciplina.deleteMany({
      where: {
        OR: [
          { turma: { anoLectivoId: { in: this.anos } } },
          { disciplinaId: { in: this.disciplinas } },
        ],
      },
    });
    await dbAdmin.turma.deleteMany({ where: { anoLectivoId: { in: this.anos } } });
    await dbAdmin.periodo.deleteMany({ where: { anoLectivoId: { in: this.anos } } });
    await dbAdmin.anoLectivo.deleteMany({ where: { id: { in: this.anos } } });
    await dbAdmin.estudante.deleteMany({ where: { id: { in: this.estudantes } } });
    await dbAdmin.encarregado.deleteMany({ where: { id: { in: this.encarregados } } });
    await dbAdmin.funcionario.deleteMany({ where: { id: { in: this.funcionarios } } });
    await dbAdmin.disciplina.deleteMany({ where: { id: { in: this.disciplinas } } });
    await dbAdmin.classe.deleteMany({ where: { id: { in: this.classes } } });
    for (const id of this.utilizadores) await limparUser(id);
  }
}
