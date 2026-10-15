# Pedido de revisão — Entrega D (Avaliação)

Data: 2026-10-16 · Revisor: Codex · Veredicto em `docs/revisoes/VEREDICTO-ENTREGA-D.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md`.

## Objectivo e aceitação (CLAUDE.md §9)
Avaliações com pesos; lançamento de notas por docente (só suas turmas); cálculo de médias (fórmula configurável — por confirmar); validação pela Direcção; publicação por turma/período; edição após publicação só com motivo + auditoria.
**Aceitação:** nota não publicada não sai do servidor para portais; docente não lança notas noutra turma.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:preflight && npm run db:deploy && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
```
Contas fictícias: `<papel>@exemplo.lamanu.test` (palavra-passe = `SEED_PASSWORD`). Seed: turma 7.ª A com Matemática e Língua Portuguesa; 1.º trimestre PUBLICADO, 2.º VALIDADO (não publicado), 3.º em RASCUNHO.

## Testes (local)
- Unitários — 41 (fórmula: arredondamento meio para cima, exactidão, entradas inválidas; permissões) · Integração (PostgreSQL real) — 116 · E2E — 23.
- **Critério «nota não publicada não sai»**: resposta do estudante e do encarregado sem valores nem IDs dos períodos validado/rascunho; vazia antes de publicar; efeito imediato ao publicar/corrigir; acesso cruzado (colega, outro encarregado, ligação não verificada/revogada); e2e confirma que o HTML da página não contém as notas não publicadas.
- **Critério «docente não lança noutra turma»**: outro docente, docente da mesma disciplina noutra turma e os 8 restantes papéis recusados e auditados; nada gravado.
- Gatilhos testados **sem passar pelo serviço**: período de outro ano, disciplina de outra turma, nota > 20, peso 0, alterar/apagar notas e avaliações de pauta validada, transições inválidas e apagar pautas.
- Concorrência: 10 lançamentos simultâneos da mesma nota (1 linha); validar vs lançar (nenhuma nota gravada depois da validação, 4 rondas).
- Auditoria atómica: falha simulada da auditoria em 5 operações → nada fica gravado.
- E2E fluxo completo com 3 browsers: docente cria avaliação e lança (lote com 21 recusado) → encarregado sem notas → Direcção valida (docente bloqueado) → publica (encarregado vê) → corrige com motivo (encarregado vê o novo valor).
- **Validação por mutação** (uma defesa de cada vez; os testes falharam em todas; código reposto e confirmado): filtro «PUBLICADA» do portal (4 falhas), filtro de disciplinas do docente (1), verificação de ser o docente (2), gatilho das notas (2), gatilho das transições (1), bloqueio da pauta (3 em 3 rondas).

## Atenção especial
1. `src/server/modules/notas-leitura.ts` — **a consulta única** e o filtro de visibilidade por papel.
2. Migração `20261016100000_avaliacao` — gatilhos `nota_pauta_bloqueada` e `pauta_transicao_valida`; uso de `app.permitir_correcao` (só `corrigirNota` o activa; os testes e o fixture e2e usam-no para limpeza).
3. `src/server/modules/pauta-lock.ts` e `pautas.ts` — bloqueios `FOR SHARE`/`FOR UPDATE` e ordem das verificações.
4. `modules/avaliacao.ts` — verificação do docente a partir da sessão e lote atómico.
5. Páginas: nenhuma lê notas fora de `notas-leitura.ts`/`pautas.ts`.
6. Peço que procurem **qualquer outro caminho** que devolva notas a estudantes/encarregados.

## CI
Verde no commit `56c3987`: https://github.com/esq-grupo/LaManus-/actions/runs/38813755295

## Limitações
Ver `docs/security.md` §9. Decisões provisórias: D4 (fórmula), validação estrita, quem corrige após publicação (ADR-0003).

## Revisão n.º 2
Corrige os 2 achados da revisão 1 (interruptor `set_config`; mover notas/avaliações entre pautas). Resposta ponto a ponto em `VEREDICTO-ENTREGA-D.md`; decisão 12 no ADR-0003.

**Mudança estrutural a rever:** a base de dados passa a ter dois papéis (`docker/db/papeis.sql`, `prisma/grants.sql`, `docs/migracoes.md`): `ADMIN_DATABASE_URL` (dono: migrações, seed, limpeza de testes) e `DATABASE_URL` (`lamanus_app`: a aplicação). `src/` nunca usa a ligação de administração.

- Testes locais: **41 unitários + 128 integração + 23 e2e, todos a passar** (a aplicação e os testes correm com o papel restrito; só a limpeza de dados e o DDL de teste usam o dono).
- `tests/integration/bd-contorno.test.ts` ataca a BD **com a ligação da aplicação**: `set_config`, mover notas/avaliações, inserir pauta publicada, alterar chaves, `TRUNCATE`, `DISABLE TRIGGER`, `SET ROLE`, chamar a função de correcção com argumentos inválidos.
- O job `compose` do CI confirma os mesmos limites num PostgreSQL criado pelo Docker Compose.
- Atenção especial: (1) `prisma/migrations/20261016200000_blindar_pautas/migration.sql` (função `e_dono_das_tabelas`, gatilhos, função `corrigir_nota_publicada`); (2) `docker/db/papeis.sql` + `prisma/grants.sql`; (3) se há **outros caminhos** que a aplicação possa usar para contornar as pautas (peço que procurem, incluindo a função de correcção: aceita o autor como argumento, porque a BD confia na aplicação para identificar a sessão).
- CI verde no commit `5a099d3`: https://github.com/esq-grupo/LaManus-/actions/runs/38817168336
- **Limitação operacional:** se em produção a aplicação correr com a ligação do dono, estas protecções deixam de valer (`docs/migracoes.md`).
