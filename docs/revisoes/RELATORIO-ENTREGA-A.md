## Relatório — Entrega A — 2026-10-13

**A. O que foi feito**
Criei o esqueleto técnico: aplicação Next.js em TypeScript estrito, estilos Tailwind, ligação a PostgreSQL com Prisma, migração inicial, dados de teste fictícios, três áreas (interna, estudante, encarregado) mais uma página de login vazia, scripts de qualidade, testes e CI no GitHub. Ainda não há login real nem dados reais.

**B. Ficheiros** — `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `prisma/` (schema, migração `fundacao`, seed), `prisma.config.ts`, `src/` (layout, páginas, `server/db.ts`, `lib/dinheiro.ts`), `tests/`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, `README.md`, docs.

**C. Comandos e resultados reais**
- `npm run lint`: 0 erros, 0 avisos (após corrigir 2 avisos)
- `npm run format:check`: ok
- `npm run typecheck`: 0 erros
- `npm test`: 5 passaram, 0 falharam
- `npm run build`: ok (6 rotas)
- `npx prisma migrate dev`: migração aplicada num PostgreSQL 16 local; `db:seed` corrido 2×, continua com 5 estudantes (idempotente)
- `npm run test:e2e`: 2 passaram (Chromium local)
- **Não executado:** `docker compose` (sem Docker no ambiente); GitHub Actions (ainda não correu).

**D. Testes de permissão negativos** — não aplicável (Entrega B).

**E. Riscos** — CI por confirmar no GitHub; Prisma 7 (8.0 ainda em RC); Next 16 é recente (consultar a documentação em `node_modules/next/dist/docs` ao programar); áreas ainda sem protecção.

**F. Decisões provisórias / perguntas ao PO**
Usei D1–D14 e P3 como provisórios. Pergunta: fazer commit do `CLAUDE.md` e `AGENTS.md` do Codex (P1)? 1. *(Recomendado)* sim, na `main`; 2. só o AGENTS.md; 3. não.

**G. Próxima acção** — entregar `docs/revisoes/PEDIDO-REVISAO-ENTREGA-A.md` ao Codex e ver se o CI fica verde no GitHub. Paro aqui.

---
### Adenda — revisão n.º 2 (2026-10-13)
**Evidência do caminho Docker Compose** (GitHub Actions, execução 38463072539, commit `3a43b38`, https://github.com/esq-grupo/LaManus-/actions/runs/38463072539):
- Job `compose` (tentativa 2): `cp .env.example .env` → `docker compose up -d --wait db` (PostgreSQL 16 *Healthy*) → `npm ci` → `db:generate` → `prisma migrate deploy` → `db:seed` → confirmação de 5 estudantes → `docker compose down -v`: **todos os passos verdes**.
- Job `verificar`: lint, format:check, typecheck, testes, migração, seed e E2E **verdes**.
- A tentativa 1 do `compose` falhou no `npm ci` com `ECONNRESET` ao descarregar binários do Prisma (falha de rede transitória, antes de qualquer passo do projecto). Foi repetida **uma vez** só o job falhado, e passou. Registo-o para transparência.
- Não consegui testar Docker no meu ambiente; a evidência é a do runner do GitHub.
