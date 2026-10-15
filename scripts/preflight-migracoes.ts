// Verificação PRÉVIA a executar ANTES de `prisma migrate deploy` numa base que já tenha dados (staging/produção).
// Procura dados que fariam falhar índices únicos introduzidos por migrações e lista-os para correcção manual.
// Só leitura: não altera nada. Uso: `npm run db:preflight` (código de saída 1 se houver problemas).
import "dotenv/config";
import pg from "pg";

export interface Problema {
  migracao: string;
  descricao: string;
  linhas: Record<string, unknown>[];
}

const VERIFICACOES = [
  {
    migracao: "20261015100000_matricula_nova_unica",
    descricao: "Estudantes com mais do que uma matrícula inicial («Nova») activa ou concluída",
    sql: `SELECT e."numeroProcesso", count(*)::int AS matriculas_nova
          FROM "Matricula" m JOIN "Estudante" e ON e.id = m."estudanteId"
          WHERE m.tipo = 'NOVA' AND m.estado IN ('ACTIVA', 'CONCLUIDA')
          GROUP BY e.id, e."numeroProcesso" HAVING count(*) > 1 ORDER BY 1`,
  },
  {
    migracao: "20261013220000_estrutura_escolar",
    descricao: "Estudantes com mais do que uma matrícula activa no mesmo ano lectivo",
    sql: `SELECT e."numeroProcesso", a.nome AS ano_lectivo, count(*)::int AS matriculas_activas
          FROM "Matricula" m JOIN "Estudante" e ON e.id = m."estudanteId" JOIN "AnoLectivo" a ON a.id = m."anoLectivoId"
          WHERE m.estado = 'ACTIVA' GROUP BY e.id, e."numeroProcesso", a.id, a.nome HAVING count(*) > 1 ORDER BY 1`,
  },
  {
    migracao: "20261013220000_estrutura_escolar",
    descricao: "Mais do que um ano lectivo ACTIVO",
    sql: `SELECT nome FROM "AnoLectivo" WHERE estado = 'ACTIVO' AND (SELECT count(*) FROM "AnoLectivo" WHERE estado = 'ACTIVO') > 1`,
  },
];

export async function procurarProblemas(cliente: Pick<pg.Client, "query">): Promise<Problema[]> {
  const problemas: Problema[] = [];
  for (const v of VERIFICACOES) {
    // As tabelas podem ainda não existir (base anterior à migração): nesse caso não há nada a verificar.
    const existe = await cliente.query(`SELECT to_regclass('"Matricula"') IS NOT NULL AS ok`);
    if (!existe.rows[0]?.ok) continue;
    const r = await cliente.query(v.sql);
    if (r.rows.length > 0)
      problemas.push({ migracao: v.migracao, descricao: v.descricao, linhas: r.rows });
  }
  return problemas;
}

async function main() {
  const cliente = new pg.Client({
    connectionString: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL,
  });
  await cliente.connect();
  try {
    const problemas = await procurarProblemas(cliente);
    if (problemas.length === 0) {
      console.log("Pré-verificação OK: nenhum dado impede as migrações pendentes.");
      return;
    }
    for (const p of problemas) {
      console.error(`\n✗ ${p.descricao}  (migração ${p.migracao})`);
      console.table(p.linhas);
    }
    console.error(
      "\nCorrija estes registos (anular ou corrigir a matrícula errada) e volte a correr antes de migrar.",
    );
    process.exitCode = 1;
  } finally {
    await cliente.end();
  }
}

if (process.argv[1]?.endsWith("preflight-migracoes.ts")) void main();
