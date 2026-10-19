# Pedido de revisão — Entrega G (Pedidos e documentos)

Data: 2026-10-19 · Revisor: Codex · Veredicto a guardar em `docs/revisoes/VEREDICTO-ENTREGA-G.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md`.

## Objectivo e aceitação (CLAUDE.md §9)
Pedido de declaração (portal ou secretaria), fluxo de aprovação, emissão PDF com dados validados, download protegido, notificações de mudança de estado. **Aceitação:** documento inacessível sem sessão/permissão; histórico do pedido auditado.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:preflight && npm run db:deploy && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
```

## Testes (local)
- **50 unitários + 207 integração + 28 e2e, todos a passar** (suite completa duas vezes seguidas sem falhas).
- `tests/integration/declaracoes.test.ts` (19): fluxo completo com PDF, avisos e auditoria; rejeição/cancelamento; 4 emissões simultâneas → números consecutivos; **9 papéis** × pedir/aprovar/emitir; quem aprova não emite e quem pede não decide (mesmo com os dois papéis); acesso cruzado (encarregado de outro estudante, por verificar, estudante alheio, Docente, Financeiro) para pedir e para descarregar; pedido não emitido não se descarrega; matrícula anulada impede emitir; situação financeira (bloqueada com atraso, permitida com encargo ainda por vencer); instantâneo imutável; BD recusa saltar estados, alterar, apagar, truncar.
- `tests/e2e/pedidos.spec.ts` (3 browsers): estudante pede → Secretaria ainda não emite → Direcção aprova (e não emite) → Secretaria emite → estudante descarrega o PDF (`%PDF`); sem sessão 401; Financeiro 404; encarregado do mesmo estudante 200; avisos.
- **Mutação** (uma defesa de cada vez; testes falharam; ficheiro e BD repostos e conferidos): escopo do portal na descarga; verificação de valores em atraso; «quem aprova não emite» (serviço + restrição); gatilho das transições.

## Atenção especial
1. `prisma/migrations/20261019100000_pedidos_documentos/migration.sql` (gatilhos, `CHECK`s) e `prisma/grants.sql`.
2. `src/server/modules/declaracoes.ts` (ordem das verificações na emissão; contador `SerieDocumento`).
3. `src/app/declaracoes/[pedidoId]/route.ts` (descarga) e `obterDocumento`.
4. Procurem **qualquer caminho** para obter um PDF sem sessão/permissão/escopo, emitir sem aprovação, ou aprovar e emitir pela mesma pessoa.

## Limitações / decisões
`docs/security.md` §12, ADR-0006. Decidido pelo PO: três tipos de declaração; «contas em dia» = sem valores em atraso.
