# ESTADO — Projecto Lá Manu (EESQ-LM-001)

Actualizado: 2026-10-13

> Regra permanente: perguntas ao PO = 3 opções, recomendada primeiro (`docs/REGRAS-COMUNICACAO.md`).

## Posição actual
- **Entrega 0:** FECHADA (Codex APROVADO COM RESSALVAS na revisão 2, ressalvas corrigidas; OK do PO em 2026-10-13).
- **Entrega A:** FECHADA (Codex APROVADO na revisão 3 + OK do PO em 2026-10-13).
- **Entrega B:** Codex **APROVADO** (revisão 2). **A aguardar OK final do PO** (`docs/checkpoints/CHECKPOINT-ENTREGA-B.md`).
- **Depois:** C — Estrutura escolar (só após o OK do PO à Entrega B).
- Decisões D1–D14 e P3 (cêntimos `BigInt`) em uso como provisórias (modo autorizar).

## Tarefas da Entrega B
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
