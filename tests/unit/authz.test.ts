import { describe, expect, it } from "vitest";
import {
  PAPEIS,
  PERMISSOES,
  areaInicial,
  can,
  podeAceder,
  podeAlterarPapeis,
  type Papel,
  type Permissao,
  type Principal,
} from "@/server/authz";
import { escopoEstudantes } from "@/server/authz/scope";

const quem = (...papeis: Papel[]): Principal => ({ id: "u1", papeis });

// Matriz esperada (docs/security.md §3): papel → permissões que NÃO pode ter.
const PROIBIDAS: Record<Papel, Permissao[]> = {
  DIRECCAO: ["notas:lancar", "financeiro:editar", "utilizadores:gerir"],
  SECRETARIA: [
    "notas:lancar",
    "pauta:publicar",
    "financeiro:editar",
    "estorno:aprovar",
    "pagamento:confirmar",
    "utilizadores:gerir",
  ],
  FINANCEIRO: [
    "notas:lancar",
    "notas:ver",
    "pauta:publicar",
    "estorno:aprovar",
    "pagamento:confirmar",
    "utilizadores:gerir",
    "estudantes:editar",
  ],
  DOCENTE: [
    "pauta:publicar",
    "financeiro:ver",
    "financeiro:editar",
    "utilizadores:gerir",
    "estudantes:editar",
    "estrutura:editar",
  ],
  RH: Object.keys(PERMISSOES) as Permissao[],
  QUALIDADE: ["notas:lancar", "financeiro:ver", "estudantes:editar", "utilizadores:gerir"],
  ESTUDANTE: [
    "estrutura:ver",
    "estudantes:editar",
    "notas:lancar",
    "financeiro:editar",
    "utilizadores:ver",
    "auditoria:ver",
    "pauta:publicar",
  ],
  ENCARREGADO: [
    "estrutura:ver",
    "estudantes:editar",
    "notas:lancar",
    "financeiro:editar",
    "utilizadores:ver",
    "auditoria:ver",
    "pauta:publicar",
  ],
  ADMIN_TECNICO: [
    "notas:ver",
    "notas:lancar",
    "financeiro:ver",
    "financeiro:editar",
    "estudantes:ver",
    "estudantes:editar",
    "pauta:publicar",
    "estorno:aprovar",
    "pagamento:confirmar",
  ],
};

describe("authz — matriz de permissões (negativos)", () => {
  for (const papel of PAPEIS) {
    it(`${papel} não tem as permissões proibidas`, () => {
      for (const p of PROIBIDAS[papel]) expect(can(quem(papel), p), `${papel} → ${p}`).toBe(false);
    });
  }

  it("negar por omissão: sem utilizador ou sem papéis não há permissões", () => {
    for (const p of Object.keys(PERMISSOES) as Permissao[]) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
      expect(can(quem(), p)).toBe(false);
    }
  });

  it("só a Direcção corrige notas de pautas validadas/publicadas", () => {
    for (const papel of PAPEIS)
      expect(can(quem(papel), "notas:corrigir"), papel).toBe(papel === "DIRECCAO");
  });

  it("Financeiro propõe estorno mas não aprova; Direcção aprova mas não propõe", () => {
    expect(can(quem("FINANCEIRO"), "estorno:propor")).toBe(true);
    expect(can(quem("FINANCEIRO"), "estorno:aprovar")).toBe(false);
    expect(can(quem("DIRECCAO"), "estorno:aprovar")).toBe(true);
    expect(can(quem("DIRECCAO"), "estorno:propor")).toBe(false);
  });

  it("só Docente lança notas; só Direcção publica pautas", () => {
    for (const papel of PAPEIS) {
      expect(can(quem(papel), "notas:lancar")).toBe(papel === "DOCENTE");
      expect(can(quem(papel), "pauta:publicar")).toBe(papel === "DIRECCAO");
    }
  });
});

describe("authz — áreas", () => {
  it("cada papel só entra na sua área", () => {
    expect(podeAceder(quem("ESTUDANTE"), "estudante")).toBe(true);
    expect(podeAceder(quem("ESTUDANTE"), "interno")).toBe(false);
    expect(podeAceder(quem("ESTUDANTE"), "encarregado")).toBe(false);
    expect(podeAceder(quem("ENCARREGADO"), "interno")).toBe(false);
    expect(podeAceder(quem("ENCARREGADO"), "estudante")).toBe(false);
    expect(podeAceder(quem("DOCENTE"), "estudante")).toBe(false);
    expect(podeAceder(quem("ADMIN_TECNICO"), "interno")).toBe(true);
    expect(podeAceder(null, "interno")).toBe(false);
  });
  it("área inicial", () => {
    expect(areaInicial(quem("ENCARREGADO"))).toBe("encarregado");
    expect(areaInicial(quem("SECRETARIA"))).toBe("interno");
    expect(areaInicial(quem())).toBeNull();
  });
});

describe("authz — separação de funções", () => {
  it("ninguém altera os próprios papéis, nem o Admin técnico", () => {
    expect(podeAlterarPapeis({ id: "a", papeis: ["ADMIN_TECNICO"] }, "a")).toBe(false);
    expect(podeAlterarPapeis({ id: "a", papeis: ["ADMIN_TECNICO"] }, "b")).toBe(true);
  });
  it("quem não gere utilizadores não altera papéis de ninguém", () => {
    expect(podeAlterarPapeis({ id: "a", papeis: ["DIRECCAO"] }, "b")).toBe(false);
    expect(podeAlterarPapeis({ id: "a", papeis: ["SECRETARIA"] }, "b")).toBe(false);
  });
});

describe("authz — escopo de estudantes", () => {
  it("estudante só vê o próprio registo (filtro derivado da sessão)", () => {
    expect(escopoEstudantes({ id: "u-estudante", papeis: ["ESTUDANTE"] })).toEqual({
      userId: "u-estudante",
    });
  });
  it("gestão vê todos; Admin técnico, RH e sem papéis não vêem nada", () => {
    expect(escopoEstudantes(quem("SECRETARIA"))).toEqual({});
    for (const papeis of [["ADMIN_TECNICO"], ["RH"], []] as Papel[][]) {
      expect(escopoEstudantes(quem(...papeis))).toEqual({ id: { in: [] } });
    }
  });
  it("encarregado: filtro exige verificado E autorização activa E ligação à sua conta", () => {
    const f = JSON.stringify(escopoEstudantes(quem("ENCARREGADO")));
    expect(f).toContain('"verificado":true');
    expect(f).toContain('"autorizacaoActiva":true');
    expect(f).toContain('"userId":"u1"');
  });
  it("docente: filtro limitado a matrículas activas em turmas que lecciona", () => {
    const f = JSON.stringify(escopoEstudantes(quem("DOCENTE")));
    expect(f).toContain('"estado":"ACTIVA"');
    expect(f).toContain('"docente":{"userId":"u1"}');
  });
});
