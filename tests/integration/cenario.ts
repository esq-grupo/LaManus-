import { randomUUID } from "node:crypto";
import type { Principal, Papel } from "@/server/authz";
import { db, criarUser, limparUser } from "./ajuda";

/** Dados isolados por teste (nomes únicos) e limpeza completa no fim. */
export class Cenario {
  utilizadores: string[] = [];
  anos: string[] = [];
  classes: string[] = [];
  disciplinas: string[] = [];
  funcionarios: string[] = [];
  estudantes: string[] = [];
  encarregados: string[] = [];
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

  async limpar() {
    await db.eventoAuditoria
      .deleteMany({ where: { actorId: { in: this.utilizadores } } })
      .catch(() => undefined);
    await db.matricula.deleteMany({
      where: {
        OR: [{ estudanteId: { in: this.estudantes } }, { anoLectivoId: { in: this.anos } }],
      },
    });
    await db.estudanteEncarregado.deleteMany({
      where: {
        OR: [
          { estudanteId: { in: this.estudantes } },
          { encarregadoId: { in: this.encarregados } },
        ],
      },
    });
    await db.turmaDisciplina.deleteMany({
      where: {
        OR: [
          { turma: { anoLectivoId: { in: this.anos } } },
          { disciplinaId: { in: this.disciplinas } },
        ],
      },
    });
    await db.turma.deleteMany({ where: { anoLectivoId: { in: this.anos } } });
    await db.periodo.deleteMany({ where: { anoLectivoId: { in: this.anos } } });
    await db.anoLectivo.deleteMany({ where: { id: { in: this.anos } } });
    await db.estudante.deleteMany({ where: { id: { in: this.estudantes } } });
    await db.encarregado.deleteMany({ where: { id: { in: this.encarregados } } });
    await db.funcionario.deleteMany({ where: { id: { in: this.funcionarios } } });
    await db.disciplina.deleteMany({ where: { id: { in: this.disciplinas } } });
    await db.classe.deleteMany({ where: { id: { in: this.classes } } });
    for (const id of this.utilizadores) await limparUser(id);
  }
}
