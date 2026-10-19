# Pedido de revisão — Entrega F (Portais)

Data: 2026-10-18 · Revisor: Codex · Veredicto a guardar em `docs/revisoes/VEREDICTO-ENTREGA-F.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md`.

## Objectivo e aceitação (CLAUDE.md §9)
Portal estudante e encarregado mobile-first; notas publicadas; situação financeira e recibos; notificações; selector de educando. **Aceitação:** testes de acesso cruzado (alterar IDs no URL/pedido → 403/404); Lighthouse mobile aceitável; páginas legíveis em telemóvel de gama baixa.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:preflight && npm run db:deploy && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
```

## Testes (local)
- **50 unitários + 187 integração + 27 e2e, todos a passar** (a suite completa correu várias vezes seguidas sem falhas).
- `tests/integration/portais.test.ts` (8): quem recebe avisos (estudante, encarregado verificado/activo/na validade — e **nenhuma linha criada** para por verificar, revogado, expirado, estudante de fora, docente, Direcção); idempotência; falha da publicação não deixa avisos; correcção e recibo geram avisos; ninguém lê/marca avisos alheios mesmo com o id; revogar a ligação esconde avisos; o texto não se altera (gatilho); acesso cruzado a notas/contas; `escopoPortal` (Docente+Encarregado).
- `tests/e2e/portais.spec.ts` (3, viewport 360×640): sem rolagem horizontal, alvos ≥ 44 px; encarregado com 2 educandos + 1 por verificar + 1 aluno de outra família (fixture própria): selector, endereço por educando, **404 igual** para por verificar/outra família/inexistente/lixo; estudante recusado nos outros portais.
- **Mutação** (uma defesa de cada vez; os testes falharam; ficheiros repostos e conferidos por `md5`): página do educando aceita qualquer id (e2e); `marcarLido` sem filtro de destinatário; leitura sem escopo; geração de avisos sem exigir ligação verificada/activa. *Nota:* a 1.ª versão do teste de geração só olhava para a lista lida (o filtro de leitura escondia a falha); passou a contar as linhas criadas.
- **Lighthouse** (v12, emulação móvel por omissão, sessão real, `next start`): estudante 0,97 desempenho / 1,00 acessibilidade / 0,96 boas práticas; encarregado 0,99 / 1,00 / 0,96. HTTP local, sem TLS.

## Atenção especial
1. `src/server/authz/scope.ts` (`escopoPortal`) e `src/server/modules/pessoas.ts` (`educandosDoPortal`).
2. `src/app/(encarregado)/encarregado/[educandoId]/page.tsx` e `src/components/PainelEducando.tsx`.
3. `src/server/modules/notificacoes.ts` e a migração `20261018100000_portais_notificacoes` (gatilho).
4. Chamadas de geração em `pautas.ts` (`publicarPauta`, `corrigirNota`) e `financeiro.ts` (`confirmarPagamento`).
5. Procurem **qualquer caminho** em que estudante/encarregado vejam dados de outro estudante, de um educando por verificar/revogado/expirado, ou notas não publicadas (inclusive nos avisos).

## Limitações / decisões provisórias
`docs/security.md` §11, ADR-0005. Só canal APP; Lighthouse sem TLS.
