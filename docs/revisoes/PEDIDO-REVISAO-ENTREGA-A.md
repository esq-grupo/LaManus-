# Pedido de revisão — Entrega A (Fundação técnica)

Data: 2026-10-13 · Revisor: Codex · Veredicto em `docs/revisoes/VEREDICTO-ENTREGA-A.md`

## Objectivo e aceitação (CLAUDE.md §9)
Scaffold Next.js+TS strict; Tailwind; Prisma+Postgres; `.env.example` sem segredos; scripts `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`; GitHub Actions; layout com 3 áreas e login vazio; seed fictício.
**Aceitação:** arranca do zero seguindo o `README.md`; CI verde; zero segredos no repositório.

## Como executar
Ver `README.md`. Resumo: `cp .env.example .env && docker compose up -d db && npm ci && npm run db:generate && npm run db:migrate && npm run db:seed && npm run dev`.
Qualidade: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e`.

## Testes
- Vitest `tests/unit/dinheiro.test.ts` (5): conversão Kz↔cêntimos, valores > Int32, rejeição de decimais, formatação.
- Playwright `tests/e2e/arranque.spec.ts` (2): página inicial com as 3 áreas; login desactivado.
- Testes de permissão: não aplicável (autenticação é a Entrega B).

## Atenção especial
1. `.gitignore` e ausência de segredos; `.env.example` só com valores fictícios de desenvolvimento.
2. Esquema Prisma mínimo (AnoLectivo, Classe, Turma, Estudante) vs. `docs/data-model.md`; uso de `BigInt`/cêntimos em `src/lib/dinheiro.ts`.
3. Prisma 7.10 (a última "latest" é 8.0 RC, evitada de propósito).
4. CI: serviço Postgres, migrate deploy, seed, Playwright.
5. Rotas das três áreas sem protecção (intencional até à Entrega B; páginas só com texto estático).

## Limitações
- Docker indisponível no ambiente do construtor. O caminho `docker compose` é exercitado pelo job `compose` do CI (execução 38463072539, verde na tentativa 2; a 1.ª falhou por ECONNRESET transitório no `npm ci`).
- Um `AGENTS.md` gerado pelo Next.js foi removido e ignorado para não colidir com o do Codex.
- Sem `Dockerfile` da aplicação, sem Nginx/Caddy e sem backups (previstos para a Entrega H).

## Revisão n.º 2
Correcção ao REPROVADO da revisão 1: ver `VEREDICTO-ENTREGA-A.md` e adenda em `RELATORIO-ENTREGA-A.md`.
