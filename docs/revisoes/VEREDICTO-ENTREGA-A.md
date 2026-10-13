# Veredicto — Entrega A — revisão n.º 1

## Resultado: REPROVADO (resumo entregue pelo PO)
- CI confirmado verde no commit `0d019d7`: lint, formatação, typecheck, testes, migração, seed e E2E (avisos de manutenção das Actions, sem falhas).
- Motivo: o arranque do PostgreSQL por `docker compose` (caminho do README) não foi confirmado — configuração válida, mas o daemon Docker não estava activo no ambiente do revisor. O CI usa um serviço Postgres próprio e não cobre este caminho.

## Resposta do construtor
**Aceite.** Não consigo executar Docker no meu ambiente, por isso não afirmo ter testado o `docker compose`. Acrescentei ao CI o job `compose`, que corre num runner com Docker: `cp .env.example .env` → `docker compose up -d --wait db` → `npm ci` → `prisma migrate deploy` → `db:seed` → confirma 5 estudantes → `docker compose down -v`. É exactamente a sequência do README. A evidência passa a ser a execução desse job no GitHub (ver relatório). Pedida revisão n.º 2.
