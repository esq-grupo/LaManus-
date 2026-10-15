import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { can, type Principal } from "@/server/authz";
import { escopoEstudantes } from "@/server/authz/scope";
import { ErroAutorizacao } from "@/server/erros";
import { formatarMedia, mediaPonderada, mediaSimples } from "@/lib/avaliacao";

/**
 * ÚNICO ponto de leitura de notas por estudante. Regras (matriz de docs/security.md):
 *  - Direcção, Secretaria, Qualidade: todas as notas, em qualquer estado da pauta;
 *  - Docente: só as notas das disciplinas que lecciona (qualquer estado), de estudantes do seu escopo;
 *  - Estudante / Encarregado: SÓ notas de pautas PUBLICADA, e só do próprio / dos educandos verificados e activos;
 *  - restantes papéis: nenhuma.
 * O filtro «PUBLICADA» é aplicado NA CONSULTA SQL (não depois): uma nota por publicar nem sai da base de dados.
 */
export type VistaNotas = "completa" | "docente" | "publicadas";

interface LinhaNota {
  nota_id: string;
  valor: number;
  avaliacao_id: string;
  avaliacao: string;
  tipo: string;
  peso: number;
  data: Date;
  disciplina_id: string;
  disciplina: string;
  periodo_id: string;
  periodo: string;
  periodo_ordem: number;
  estado_pauta: string | null;
}

function vistasDe(actor: Principal): VistaNotas[] {
  const p = new Set(actor.papeis);
  const vistas: VistaNotas[] = [];
  if (p.has("DIRECCAO") || p.has("SECRETARIA") || p.has("QUALIDADE")) vistas.push("completa");
  if (p.has("DOCENTE")) vistas.push("docente");
  if (p.has("ESTUDANTE") || p.has("ENCARREGADO")) vistas.push("publicadas");
  return vistas;
}

async function consultar(
  estudanteId: string,
  vista: VistaNotas,
  actorId: string,
): Promise<LinhaNota[]> {
  const soPublicadas = vista === "publicadas";
  const soDocente = vista === "docente";
  return db.$queryRaw<LinhaNota[]>(Prisma.sql`
    SELECT n.id AS nota_id, n.valor, a.id AS avaliacao_id, a.nome AS avaliacao, a.tipo::text AS tipo, a.peso, a.data,
           d.id AS disciplina_id, d.nome AS disciplina, p.id AS periodo_id, p.nome AS periodo, p.ordem AS periodo_ordem,
           pp.estado::text AS estado_pauta
    FROM "Nota" n
    JOIN "Avaliacao" a ON a.id = n."avaliacaoId"
    JOIN "TurmaDisciplina" td ON td.id = a."turmaDisciplinaId"
    JOIN "Disciplina" d ON d.id = td."disciplinaId"
    JOIN "Periodo" p ON p.id = a."periodoId"
    LEFT JOIN "PautaPublicacao" pp ON pp."turmaId" = a."turmaId" AND pp."periodoId" = a."periodoId"
    WHERE n."estudanteId" = ${estudanteId}::uuid
      AND (${!soPublicadas} OR pp.estado = 'PUBLICADA')
      AND (${!soDocente} OR td."docenteId" IN (SELECT f.id FROM "Funcionario" f WHERE f."userId" = ${actorId}::uuid))
    ORDER BY p.ordem, d.nome, a.data, a.nome`);
}

export interface NotasDoEstudante {
  estudanteId: string;
  periodos: {
    periodoId: string;
    periodo: string;
    mediaGeral: string | null;
    disciplinas: {
      disciplinaId: string;
      disciplina: string;
      media: string | null;
      avaliacoes: {
        avaliacaoId: string;
        nome: string;
        tipo: string;
        peso: number;
        valor: number;
        notaId: string;
        estadoPauta: string | null;
      }[];
    }[];
  }[];
}

/** Devolve `null` se o estudante estiver fora do escopo do utilizador (o chamador responde 404). */
export async function notasDoEstudante(
  actor: Principal,
  estudanteId: string,
): Promise<NotasDoEstudante | null> {
  if (!can(actor, "notas:ver")) throw new ErroAutorizacao();
  const vistas = vistasDe(actor);
  if (vistas.length === 0) throw new ErroAutorizacao();
  const visivel = await db.estudante.findFirst({
    where: { AND: [{ id: estudanteId }, escopoEstudantes(actor), { archivedAt: null }] },
    select: { id: true },
  });
  if (!visivel) return null;

  const porId = new Map<string, LinhaNota>();
  for (const v of vistas)
    for (const l of await consultar(estudanteId, v, actor.id)) porId.set(l.nota_id, l);
  const linhas = [...porId.values()].sort(
    (a, b) =>
      a.periodo_ordem - b.periodo_ordem ||
      a.disciplina.localeCompare(b.disciplina) ||
      a.data.getTime() - b.data.getTime(),
  );

  const periodos = new Map<string, NotasDoEstudante["periodos"][number] & { _medias: number[] }>();
  for (const l of linhas) {
    let p = periodos.get(l.periodo_id);
    if (!p)
      periodos.set(
        l.periodo_id,
        (p = {
          periodoId: l.periodo_id,
          periodo: l.periodo,
          mediaGeral: null,
          disciplinas: [],
          _medias: [],
        }),
      );
    let d = p.disciplinas.find((x) => x.disciplinaId === l.disciplina_id);
    if (!d)
      p.disciplinas.push(
        (d = {
          disciplinaId: l.disciplina_id,
          disciplina: l.disciplina,
          media: null,
          avaliacoes: [],
        }),
      );
    d.avaliacoes.push({
      avaliacaoId: l.avaliacao_id,
      nome: l.avaliacao,
      tipo: l.tipo,
      peso: l.peso,
      valor: l.valor,
      notaId: l.nota_id,
      estadoPauta:
        vistas.includes("completa") || vistas.includes("docente") ? l.estado_pauta : null,
    });
  }
  for (const p of periodos.values()) {
    for (const d of p.disciplinas) {
      const m = mediaPonderada(d.avaliacoes.map((a) => ({ valor: a.valor, peso: a.peso })));
      d.media = m === null ? null : formatarMedia(m);
      if (m !== null) p._medias.push(m);
    }
    const g = mediaSimples(p._medias);
    p.mediaGeral = g === null ? null : formatarMedia(g);
  }
  return {
    estudanteId,
    periodos: [...periodos.values()].map(({ _medias, ...p }) => (void _medias, p)),
  };
}
