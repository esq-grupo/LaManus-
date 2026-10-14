# Pedido de revisão — Entrega C (Estrutura escolar)

Data: 2026-10-13 · Revisor: Codex · Veredicto em `docs/revisoes/VEREDICTO-ENTREGA-C.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md`.

## Objectivo e aceitação (CLAUDE.md §9)
CRUD de anos lectivos, períodos, classes, turmas, disciplinas, atribuição de docentes; estudantes e encarregados (pesquisa por nome, n.º de processo, BI); relação estudante–encarregado com verificação; matrículas (nova/renovação), transferência de turma auditada.
**Aceitação:** não é possível duas matrículas activas no mesmo ano; encarregado não verificado não vê nada; e2e do fluxo de matrícula.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:deploy && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
```
Contas fictícias: `<papel>@exemplo.lamanu.test` (palavra-passe = `SEED_PASSWORD`). Seed: 1 encarregado com 3 educandos (1 verificado, 1 por verificar, 1 com autorização revogada).

## Testes (local)
- Unitários — 30 · Integração (PostgreSQL real) — 66 · E2E — 15.
- Matrículas: duplicada recusada; **10 pedidos simultâneos → 1 criado**; a BD recusa a 2.ª activa e a turma de outro ano **sem passar pelo serviço**; NOVA/RENOVAÇÃO; ano fechado; transferência (historial, motivo, mesmo ano, simultaneidade); permissões negativas dos 7 papéis não autorizados.
- Escopo: encarregado (não verificada, revogada, fora de validade, arquivado, sem ficha, acesso cruzado, vários educandos); estudante; docente (e perda de acesso após transferência); gestão; Admin técnico/RH recusados; BI mascarado; pesquisa limitada ao escopo; IDs inválidos.
- Estrutura/pessoas: permissões negativas por papel; um só ano activo; períodos dentro do ano; duplicados; BI/n.º de processo únicos; BI nunca completo na auditoria; associação de contas.
- E2E: fluxo completo (criar estudante → ligar encarregado → matricular → duplicada bloqueada → transferir → verificar → encarregado passa a ver → revogar → deixa de ver, **com dois browsers em simultâneo**); acesso cruzado por URL (encarregado, estudante, Admin técnico); 404 igual para inexistente; Financeiro sem formulários de edição.
- **Validação por mutação** (removi uma defesa de cada vez; os testes falharam e repus o código): `verificado:true` (3 falhas), `autorizacaoActiva:true` (1), `estado ACTIVA` do docente (1), pesquisa sem escopo (3), índice parcial da matrícula (3).

## Atenção especial
1. `src/server/authz/scope.ts` (filtros) e `modules/pessoas.ts` (`obterEstudante`, `meusEducandos`).
2. Migração `20261013220000_estrutura_escolar` (índices parciais, FK composta, CHECK) e a nota sobre `migrate diff` no ADR-0002.
3. `modules/matriculas.ts`: transacção da transferência e mensagens de erro para violações de unicidade.
4. `src/app/(interno)/interno/acoes.ts`: todas as acções verificam permissão no servidor.
5. `FormAcao.tsx`: deixou de usar `<form action>` para não perder o que o utilizador escreveu quando há erro.
6. D9 decidida pelo PO (só o Admin técnico cria contas) — ADR-0002.

## Limitações
Ver `docs/security.md` §8. O encarregado só vê nome e n.º de processo (notas e finanças nas Entregas D–F). CI verde no commit `252a0f0`: https://github.com/esq-grupo/LaManus-/actions/runs/38471439069
