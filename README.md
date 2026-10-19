# Lá Manu — Plataforma de Gestão Escolar (EESQ-LM-001)

Projecto da E-ESQ para o Complexo Escolar Privado Lá Manu. Documentação em `docs/` (ponto de partida: `docs/ESTADO.md`).

## Requisitos

Node 22+, npm 10+, Docker (ou PostgreSQL 16 local).

## Arrancar do zero

```bash
git clone https://github.com/esq-grupo/LaManus-.git && cd LaManus-
cp .env.example .env            # valores fictícios de desenvolvimento
docker compose up -d db         # PostgreSQL 16 (alternativa: Postgres local com as mesmas credenciais)
npm ci
npm run db:generate
npm run db:deploy               # aplica as migrações (como dono) e os privilégios do papel restrito da aplicação
npm run db:seed                 # dados FICTÍCIOS
npm run dev                     # http://localhost:3000
```

## Qualidade

| Comando                | O que faz                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `npm run lint`         | ESLint                                                                               |
| `npm run format:check` | Prettier                                                                             |
| `npm run typecheck`    | TypeScript estrito                                                                   |
| `npm test`             | Testes unitários/integração (Vitest)                                                 |
| `npm run test:e2e`     | Testes ponta-a-ponta (Playwright; `npx playwright install chromium` na primeira vez) |

## Base de dados: dois papéis

`ADMIN_DATABASE_URL` (dono: migrações, seed) e `DATABASE_URL` (papel restrito `lamanus_app`, usado pela aplicação). O `docker compose` cria os dois. Ver `docs/migracoes.md`.

## Regras

Nunca usar dados reais fora de produção · nunca fazer commit de `.env` · dinheiro em cêntimos (`BigInt`) via `src/lib/dinheiro.ts`. Ver `docs/security.md`.

## Adenda (2026-10-20)

Backup, restauro, instalação em staging e primeira conta: ver `docs/deployment.md`, `docs/runbook-incidentes.md` e `docs/go-live.md`.
