## Relatório — Entrega D — 2026-10-16

**A. O que foi feito**
Os docentes criam avaliações (com peso) nas suas disciplinas e lançam as notas; a Direcção valida a pauta de cada turma e período e depois publica. Só então estudantes e encarregados vêem as notas, com as médias. Depois de validada, ninguém mexe nas notas (nem por engano nem por outro caminho); depois de publicada, só a Direcção corrige, com motivo, e fica tudo registado.

**B. Ficheiros** — migração `20261016100000_avaliacao`, `src/lib/avaliacao.ts`, `src/server/modules/{avaliacao,pautas,notas-leitura,pauta-lock}.ts`, `src/server/accao.ts`, páginas de notas e pautas, portais, seed, testes, ADR-0003, docs.

**C. Comandos e resultados reais (local)**
- `lint`: 0 erros · `format:check`: ok · `typecheck`: 0 erros
- `npm test`: **157 passaram, 0 falharam** (41 unitários + 116 integração)
- `npm run test:e2e`: **23 passaram, 0 falharam**
- Mutações: 6 defesas desligadas uma a uma → os testes falharam em todas; código reposto e confirmado igual ao original.
- CI no GitHub: ver adenda.

**D. Testes de permissão negativos** — ver o pedido de revisão (lançar, validar, publicar, reabrir, corrigir, ler notas, ler pautas, para todos os papéis).

**E. Riscos / limitações** — `docs/security.md` §9: fórmula (D4) e validação estrita provisórias; sem notificações nem boletim em PDF; sem média anual.

**F. Decisões e pergunta ao PO** — ADR-0003. A pergunta «quem corrige notas já publicadas» fica feita com 3 opções.

**G. Próxima acção** — entregar `docs/revisoes/PEDIDO-REVISAO-ENTREGA-D.md` ao Codex. Paro aqui.
