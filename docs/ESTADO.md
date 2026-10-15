# ESTADO — Projecto Lá Manu (EESQ-LM-001)

Actualizado: 2026-10-13

> Regra permanente: perguntas ao PO = 3 opções, recomendada primeiro (`docs/REGRAS-COMUNICACAO.md`).

## Posição actual
- **Entrega 0:** FECHADA (Codex APROVADO COM RESSALVAS na revisão 2, ressalvas corrigidas; OK do PO em 2026-10-13).
- **Entrega A:** FECHADA (Codex APROVADO na revisão 3 + OK do PO em 2026-10-13).
- **Entrega B:** FECHADA (Codex APROVADO na revisão 2 + OK do PO em 2026-10-13).
- **Entrega C:** FECHADA (Codex APROVADO COM RESSALVA OPERACIONAL — tratada com `db:preflight` — + OK do PO em 2026-10-16).
- **Entrega actual:** D — Avaliação. Implementada; **a aguardar revisão do Codex** (`docs/revisoes/PEDIDO-REVISAO-ENTREGA-D.md`).
- **Depois:** E — Financeiro base (só após Codex APROVADO + OK PO na D).
- Decisões D1–D14 e P3 (cêntimos `BigInt`) em uso como provisórias (modo autorizar).

## Tarefas da Entrega D
- [x] Avaliações com pesos; lançamento de notas só pelo docente da disciplina
- [x] Médias (fórmula D4 provisória: ponderada, 1 casa, meio para cima), em inteiros
- [x] Pautas: validar → publicar (e reabrir); correcção após publicação com motivo (Direcção)
- [x] Portais: só notas publicadas (filtro na consulta SQL)
- [x] Testes: 41 unitários, 116 integração, 23 e2e

## Tarefas da Entrega C (fechada)
- [x] Anos lectivos, períodos, classes, turmas, disciplinas, funcionários, atribuição de docentes
- [x] Estudantes e encarregados (pesquisa por nome, n.º de processo e BI)
- [x] Ligação estudante–encarregado com verificação e revogação
- [x] Matrículas (nova/renovação), transferência de turma auditada, anulação
- [x] Escopo real: estudante, encarregado, docente
- [x] Testes: 31 unitários, 79 integração, 17 e2e

## Tarefas da Entrega B (fechada)
- [x] Modelo User/Role/Permission/Session/PasswordReset/EventoAuditoria + migração (trigger imutável)
- [x] Login/logout, bloqueio (conta e IP), política de passwords, recuperação
- [x] Camada `authz` (can, áreas, escopo, separação de funções)
- [x] Protecção por área (DAL + proxy optimista)
- [x] Gestão de utilizadores (Admin técnico)
- [x] Auditoria de login, papéis e acessos negados
- [x] Testes: 29 unitários, 29 integração, 8 e2e

## Tarefas da Entrega A (fechada)
- [x] Scaffold Next.js 16 + TypeScript strict
- [x] Tailwind CSS 4
- [x] Prisma 7 + PostgreSQL 16 (`docker-compose.yml`), migração inicial
- [x] `.env.example` (sem segredos reais)
- [x] Scripts `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`
- [x] GitHub Actions (`.github/workflows/ci.yml`): jobs `verificar` e `compose` verdes (execução 38463072539)
- [x] Layout com 3 áreas (interno, estudante, encarregado) + login vazio
- [x] Seed fictício idempotente
- [x] `README.md`

## Pendências registadas
- P1 (guardar CLAUDE.md/AGENTS.md no repo), P3 (unidade monetária) — aguardam PO/escola.
- Verificar renderização do Mermaid no GitHub.
- Atribuir nomes aos responsáveis dos riscos.
- Teste de carga do servidor (ADR-0001) — Entrega F.
- Docker não disponível no ambiente do construtor; o `docker compose` é validado pelo job `compose` do CI.
- Avisos das Actions: Node 20 deprecated em `actions/checkout@v4`/`setup-node@v4` e `eslint@9` sem suporte futuro — tratar antes de Setembro/2027 (baixo).
- Next.js gera um `AGENTS.md` ao instalar; foi removido e ignorado para não colidir com o manual do Codex.
- Limitações da Entrega B: ver `docs/security.md` §7.
- Limpeza agendada de sessões/tentativas/resets — por implementar.
- Recomendações do Codex (Entrega B): limite por IP de melhor esforço; bloqueio por conta como vector de abuso; configurar SMTP antes da produção.
- Entrega C: D9 decidida pelo PO em 2026-10-14 — só o Admin técnico cria contas (ADR-0002); a confirmar com a escola. Verificação documental da ligação sem anexo (Entrega G).
- Antes de migrar bases com dados: `npm run db:preflight` (docs/migracoes.md).
- Entrega D: fórmula (D4) e validação estrita provisórias; quem corrige notas publicadas: decidido pelo PO em 2026-10-16 (só a Direcção, com motivo) — ADR-0003; a confirmar com a escola.
