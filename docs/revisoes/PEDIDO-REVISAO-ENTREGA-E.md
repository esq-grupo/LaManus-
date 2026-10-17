# Pedido de revisão — Entrega E (Financeiro base)

Data: 2026-10-17 · Revisor: Codex · Veredicto a guardar em `docs/revisoes/VEREDICTO-ENTREGA-E.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md`.

## Objectivo e aceitação (CLAUDE.md §9)
Tipos de encargo; geração em lote de propinas mensais; pagamento (total/parcial) com alocação automática ao encargo mais antigo (configurável); recibo PDF com numeração sequencial sem saltos; estorno com aprovação e movimento inverso; saldo calculado; relatórios (dívidas por turma, recebimentos por período, extracto por estudante).
**Aceitação:** testes de reconciliação (Σ alocações = Σ pagos; saldo = Σ encargos − Σ alocações); nenhuma rota edita o valor de um pagamento existente; um pagamento não passa a CONFIRMADO sem procedimento autorizado.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:preflight && npm run db:deploy && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
```
Contas fictícias: `<papel>@exemplo.lamanu.test` (palavra-passe = `SEED_PASSWORD`).

## Desenho em 6 linhas
1. Dinheiro em cêntimos (`BIGINT`); saldo e crédito **calculados**, nunca guardados.
2. A aplicação **não escreve** em `Pagamento`, `AlocacaoPagamento`, `Estorno`, `EstornoAlocacao`, `Recibo`, `SerieRecibo` (`prisma/grants.sql`); gatilhos repetem a regra, também para o dono.
3. Os movimentos passam por 7 funções `SECURITY DEFINER` que autenticam o autor pelo **token da sessão** e verificam a permissão (sem argumento «autor»): registar, anular, confirmar, alocar manualmente, propor/rejeitar/aprovar estorno.
4. Controlo duplo: quem regista não confirma; quem propõe não aprova (função + `CHECK`).
5. Recibo: contador por (série, ano) bloqueado `FOR UPDATE` na transacção da confirmação.
6. Leitura: `escopoFinanceiro` (gestão: todos; estudante: o próprio; encarregado: educandos verificados/activos/na validade; Docente+Encarregado não vê alunos da turma).

## Testes (local)
- **48 unitários + 178 integração + 24 e2e, todos a passar.**
- `tests/integration/financeiro-bd.test.ts` (16): ataques com a ligação restrita da aplicação (INSERT/UPDATE/DELETE/TRUNCATE em todas as tabelas de movimentos); o dono também não altera valor nem salta estados; token inválido/hash/expirado/revogado, permissão em falta, mesma pessoa a registar e confirmar; alocação mais antiga primeiro, parcial, excedente → crédito, modo manual; 8 confirmações concorrentes → números consecutivos e distintos; confirmação dupla simultânea → um só recibo; falha da auditoria → nada gravado e o número não se perde; estorno parcial/total, crédito primeiro, ordem determinista, proponente ≠ aprovador; reconciliação detecta violação injectada.
- `tests/integration/financeiro.test.ts` (26): serviço por papel (9 papéis × registar/criar tipo/confirmar/aprovar/propor), geração em lote idempotente e só matrículas activas, escopo (estudante, encarregado verificado/não verificado/sem autorização/validade expirada, Docente, RH, Qualidade, Admin técnico, Docente+Encarregado), saldo e extracto, relatórios.
- E2E (3 browsers): Financeiro cria tipo e gera propinas (repetir não duplica) → regista 60 000 Kz (contas não mudam; sem botão de confirmar) → Direcção confirma → dívida 0, crédito 10 000 Kz, **PDF** descarregado (`%PDF`) → estudante e encarregado vêem e descarregam; sem sessão = 401; estudante recusado no financeiro → estorno proposto e aprovado → crédito 0 → verificação das contas coerente.
- **Validação por mutação** (uma defesa de cada vez; os testes falharam; funções repostas e conferidas por `md5`): desligar os gatilhos de pagamento/alocação/recibo (2 falhas); retirar o controlo duplo da confirmação e a restrição (2 falhas); retirar o controlo do proponente no estorno (2 falhas).
- **Erro meu apanhado:** a ordem «alocação mais recente» do estorno era ambígua (as alocações de uma confirmação partilham o `createdAt`) → teste intermitente (~2 em 3); reproduzido e corrigido com a migração `20261017110000_estorno_ordem_determinista` (8/8 execuções depois).

## Atenção especial
1. `prisma/migrations/20261017100000_financeiro/migration.sql` — gatilhos, `autenticar_e_autorizar` e as 7 funções; `20261017110000…` (ordem do estorno).
2. `prisma/grants.sql` — retiradas de escrita.
3. `src/server/modules/financeiro.ts` e `src/server/authz/scope.ts` (`escopoFinanceiro`).
4. `src/app/recibos/[pagamentoId]/route.ts` — verificação em cada descarga.
5. Procurem **qualquer caminho** que permita alterar o valor de um pagamento, confirmar sem a Direcção, confirmar o próprio registo, ou emitir dois recibos com o mesmo número.

## Limitações / decisões provisórias
`docs/security.md` §10. Quem confirma pagamentos (Direcção) é provisório; isolamento de sessões/papéis/auditoria fica para a Entrega H (ADR-0003, decisão 13).
