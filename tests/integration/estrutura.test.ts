import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErroAutorizacao, ErroValidacao } from "@/server/erros";
import { PAPEIS, can, type Papel } from "@/server/authz";
import {
  atribuirDocente,
  criarAnoLectivo,
  criarClasse,
  criarDisciplina,
  criarFuncionario,
  criarPeriodo,
  criarTurma,
  listarEstrutura,
  mudarEstadoAnoLectivo,
} from "@/server/modules/estrutura";
import {
  actualizarEstudante,
  associarConta,
  criarEstudante,
  ligarEncarregado,
} from "@/server/modules/pessoas";
import { db, prepararBd } from "./ajuda";
import { Cenario } from "./cenario";

const c = new Cenario();
beforeAll(prepararBd);
afterAll(async () => {
  await c.limpar();
});

describe("estrutura escolar", () => {
  it("só quem tem estrutura:editar (Direcção, Secretaria, Admin técnico) altera a estrutura; os outros 6 são recusados", async () => {
    const ano = await c.ano();
    for (const papel of PAPEIS) {
      const u = await c.principal(papel);
      const nome = `X-${c.sufixo}-${papel}`;
      const accoes = [
        () => criarAnoLectivo(u, { nome, inicio: "2300-09-01", fim: "2301-07-15" }),
        () => criarClasse(u, { nome, ordem: 99999 }),
        () => criarDisciplina(u, { nome }),
        () =>
          criarPeriodo(u, {
            anoLectivoId: ano.id,
            ordem: 1,
            nome,
            inicio: ano.inicio.toISOString().slice(0, 10),
            fim: ano.fim.toISOString().slice(0, 10),
          }),
      ];
      for (const accao of accoes) {
        if (can(u, "estrutura:editar")) continue;
        await expect(accao(), papel).rejects.toBeInstanceOf(ErroAutorizacao);
      }
      if (!can(u, "estrutura:ver"))
        await expect(listarEstrutura(u), papel).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    // Nada foi criado pelos papéis recusados.
    expect(
      await db.disciplina.count({ where: { nome: { startsWith: `X-${c.sufixo}-` } } }),
    ).toBeLessThanOrEqual(3);
  });

  it("ano lectivo: fim posterior ao início, nome único e só UM activo de cada vez", async () => {
    const sec = await c.principal("SECRETARIA");
    const nome = `Ano-${c.sufixo}`;
    await expect(
      criarAnoLectivo(sec, { nome, inicio: "2400-09-01", fim: "2400-01-01" }),
    ).rejects.toThrow(/posterior/);
    const a = await criarAnoLectivo(sec, { nome, inicio: "2400-09-01", fim: "2401-07-15" });
    c.anos.push(a);
    await expect(
      criarAnoLectivo(sec, { nome, inicio: "2400-09-01", fim: "2401-07-15" }),
    ).rejects.toThrow(/Já existe/);
    const b = await criarAnoLectivo(sec, {
      nome: `${nome}-b`,
      inicio: "2401-09-01",
      fim: "2402-07-15",
    });
    c.anos.push(b);
    // Activar A (pode já existir um activo do seed → também falha, o que também prova a regra); B nunca pode ficar activo ao mesmo tempo.
    await mudarEstadoAnoLectivo(sec, a, "ACTIVO").catch((e) =>
      expect(e).toBeInstanceOf(ErroValidacao),
    );
    await expect(mudarEstadoAnoLectivo(sec, b, "ACTIVO")).rejects.toThrow(
      /já existe um ano lectivo activo/i,
    );
    expect(await db.anoLectivo.count({ where: { estado: "ACTIVO" } })).toBe(1);
    // Se A ficou activo, fechar e reabrir não é possível: fechado é definitivo.
    const aEstado = (await db.anoLectivo.findUniqueOrThrow({ where: { id: a } })).estado;
    if (aEstado === "ACTIVO") {
      await mudarEstadoAnoLectivo(sec, a, "FECHADO");
      await expect(mudarEstadoAnoLectivo(sec, a, "ACTIVO")).rejects.toThrow(/PLANEADO/);
    }
  });

  it("períodos têm de estar dentro do ano e não repetir a ordem", async () => {
    const sec = await c.principal("SECRETARIA");
    const ano = await c.ano();
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    const ok = {
      anoLectivoId: ano.id,
      ordem: 1,
      nome: "1.º trimestre",
      inicio: dia(ano.inicio),
      fim: dia(new Date(ano.inicio.getTime() + 90 * 864e5)),
    };
    await criarPeriodo(sec, ok);
    await expect(criarPeriodo(sec, ok)).rejects.toThrow(/mesma ordem|ordem/);
    await expect(criarPeriodo(sec, { ...ok, ordem: 2, inicio: "1999-01-01" })).rejects.toThrow(
      /dentro do ano/,
    );
    await expect(criarPeriodo(sec, { ...ok, ordem: 3, fim: ok.inicio })).rejects.toThrow(
      /posterior/,
    );
  });

  it("turma: valida classe/ano, nome único por classe e ano, turno válido", async () => {
    const sec = await c.principal("SECRETARIA");
    const ano = await c.ano();
    const classe = await c.classe();
    const dados = { nome: "A", turno: "Manhã", classeId: classe.id, anoLectivoId: ano.id };
    await criarTurma(sec, dados);
    await expect(criarTurma(sec, dados)).rejects.toThrow(/Já existe/);
    await expect(criarTurma(sec, { ...dados, nome: "B", turno: "Madrugada" })).rejects.toThrow(
      /Turno/,
    );
    await expect(
      criarTurma(sec, { ...dados, nome: "C", classeId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toThrow(/Classe inexistente/);
  });

  it("atribuir docente: só funcionários com conta de Docente; substituir regista antes/depois", async () => {
    const sec = await c.principal("SECRETARIA");
    const doc1 = await c.principal("DOCENTE");
    const doc2 = await c.principal("DOCENTE");
    const naoDocente = await c.principal("FINANCEIRO");
    const f1 = await c.funcionario(doc1.id);
    const f2 = await c.funcionario(doc2.id);
    const fSemConta = await c.funcionario();
    const fFin = await c.funcionario(naoDocente.id);
    const ano = await c.ano();
    const classe = await c.classe();
    const turma = await c.turma(ano.id, classe.id);
    const disc = await c.disciplina();
    const base = { turmaId: turma.id, disciplinaId: disc.id };
    await expect(atribuirDocente(sec, { ...base, docenteId: fSemConta.id })).rejects.toThrow(
      /conta com o papel Docente/,
    );
    await expect(atribuirDocente(sec, { ...base, docenteId: fFin.id })).rejects.toThrow(
      /conta com o papel Docente/,
    );
    await atribuirDocente(sec, { ...base, docenteId: f1.id });
    await atribuirDocente(sec, { ...base, docenteId: f2.id });
    const ev = await db.eventoAuditoria.findMany({
      where: { acao: "DOCENTE_ATRIBUIDO", actorId: sec.id },
      orderBy: { em: "desc" },
    });
    expect(ev[0]?.antes).toEqual({ docenteId: f1.id });
    expect(await db.turmaDisciplina.count({ where: base })).toBe(1);
  });

  it("criar funcionário com conta inexistente é recusado", async () => {
    const sec = await c.principal("SECRETARIA");
    await expect(
      criarFuncionario(sec, {
        nome: "Ninguém Teste",
        cargo: "Docente",
        emailConta: "naoexiste@teste.lamanu.test",
      }),
    ).rejects.toThrow(/Não existe nenhuma conta/);
  });
});

describe("estudantes e encarregados", () => {
  it("n.º de processo e BI únicos; BI normalizado; BI nunca completo na auditoria", async () => {
    const sec = await c.principal("SECRETARIA");
    const proc = `P-${c.sufixo}`;
    const bi = `bi ${c.sufixo} 99`;
    const id = await criarEstudante(sec, {
      numeroProcesso: proc,
      nome: "Maria da Silva Teste",
      dataNascimento: "2012-03-04",
      bi,
    });
    c.estudantes.push(id);
    await expect(
      criarEstudante(sec, {
        numeroProcesso: proc,
        nome: "Outro Nome Teste",
        dataNascimento: "2012-03-04",
      }),
    ).rejects.toThrow(/Já existe/);
    await expect(
      criarEstudante(sec, {
        numeroProcesso: `${proc}-2`,
        nome: "Outro Nome Teste",
        dataNascimento: "2012-03-04",
        bi,
      }),
    ).rejects.toThrow(/Já existe/);
    expect((await db.estudante.findUniqueOrThrow({ where: { id } })).bi).toBe(
      bi.replace(/\s+/g, "").toUpperCase(),
    );
    const ev = await db.eventoAuditoria.findFirst({
      where: { acao: "ESTUDANTE_CRIADO", entidadeId: id },
    });
    expect(JSON.stringify(ev)).not.toContain(bi.replace(/\s+/g, "").toUpperCase());
  });

  it("recusa data de nascimento futura, datas impossíveis e nomes curtos", async () => {
    const sec = await c.principal("SECRETARIA");
    const base = {
      numeroProcesso: `Q-${c.sufixo}`,
      nome: "Nome Completo Teste",
      dataNascimento: "2012-03-04",
    };
    await expect(criarEstudante(sec, { ...base, dataNascimento: "2999-01-01" })).rejects.toThrow(
      /futura/,
    );
    await expect(criarEstudante(sec, { ...base, dataNascimento: "2012-02-31" })).rejects.toThrow(
      /Data inválida/,
    );
    await expect(criarEstudante(sec, { ...base, nome: "Al" })).rejects.toThrow(/nome completo/);
  });

  it("só Direcção e Secretaria criam/actualizam estudantes e ligam encarregados", async () => {
    const e = await c.estudante();
    for (const papel of PAPEIS.filter((p) => !["DIRECCAO", "SECRETARIA"].includes(p))) {
      const u = await c.principal(papel as Papel);
      await expect(
        criarEstudante(u, {
          numeroProcesso: `Z-${c.sufixo}-${papel}`,
          nome: "Nome Completo Teste",
          dataNascimento: "2012-03-04",
        }),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(
        actualizarEstudante(u, e.id, {
          nome: "Nome Alterado Teste",
          dataNascimento: "2012-03-04",
          estado: "ACTIVO",
        }),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
      await expect(
        ligarEncarregado(u, { estudanteId: e.id, nome: "Intruso Teste", parentesco: "Pai" }),
        papel,
      ).rejects.toBeInstanceOf(ErroAutorizacao);
    }
    expect((await db.estudante.findUniqueOrThrow({ where: { id: e.id } })).nome).toBe(
      "Estudante de Teste",
    );
  });

  it("encarregado ligado nasce NÃO verificado; o mesmo BI reutiliza o encarregado (vários educandos); um só principal", async () => {
    const sec = await c.principal("SECRETARIA");
    const e1 = await c.estudante();
    const e2 = await c.estudante();
    const bi = `ENC${c.sufixo}77`;
    const enc = await ligarEncarregado(sec, {
      estudanteId: e1.id,
      nome: "Joaquim Teste Pai",
      bi,
      parentesco: "Pai",
      principal: "on",
    });
    c.encarregados.push(enc);
    const enc2 = await ligarEncarregado(sec, {
      estudanteId: e2.id,
      nome: "Joaquim Teste Pai",
      bi,
      parentesco: "Pai",
    });
    expect(enc2).toBe(enc);
    const l = await db.estudanteEncarregado.findUniqueOrThrow({
      where: { estudanteId_encarregadoId: { estudanteId: e1.id, encarregadoId: enc } },
    });
    expect(l).toMatchObject({ verificado: false, autorizacaoActiva: true, principal: true });
    await expect(
      ligarEncarregado(sec, {
        estudanteId: e1.id,
        nome: "Joaquim Teste Pai",
        bi,
        parentesco: "Pai",
      }),
    ).rejects.toThrow(/já está ligado/);
    // Segundo principal para o mesmo estudante substitui o primeiro (a BD só admite um).
    await ligarEncarregado(sec, {
      estudanteId: e1.id,
      nome: "Rosa Teste Mãe",
      bi: `ENC${c.sufixo}78`,
      parentesco: "Mãe",
      principal: "on",
    });
    expect(
      await db.estudanteEncarregado.count({ where: { estudanteId: e1.id, principal: true } }),
    ).toBe(1);
    await expect(
      db.estudanteEncarregado.updateMany({
        where: { estudanteId: e1.id },
        data: { principal: true },
      }),
    ).rejects.toThrow();
  });

  it("associar conta exige o papel certo e não a partilha entre pessoas", async () => {
    const sec = await c.principal("SECRETARIA");
    const user = await c.principal("ENCARREGADO");
    const naoEnc = await c.principal("DOCENTE");
    const enc1 = await c.encarregado();
    const enc2 = await c.encarregado();
    await expect(
      associarConta(sec, { tipo: "encarregado", id: enc1.id }, naoEnc.email),
    ).rejects.toThrow(/papel Encarregado/);
    await associarConta(sec, { tipo: "encarregado", id: enc1.id }, user.email);
    await expect(
      associarConta(sec, { tipo: "encarregado", id: enc2.id }, user.email),
    ).rejects.toThrow(/já está associada/);
  });
});
