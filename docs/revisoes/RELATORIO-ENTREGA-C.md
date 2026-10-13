## Relatório — Entrega C — 2026-10-13

**A. O que foi feito**
A escola já pode registar anos lectivos, trimestres, classes, turmas, disciplinas e docentes; registar estudantes e encarregados e pesquisá-los por nome, n.º de processo ou BI; matricular (nova ou renovação), transferir de turma (com motivo e histórico) e anular. O encarregado só vê um educando depois de a Secretaria **verificar** a ligação, e deixa de o ver no instante em que a autorização é revogada. Um estudante nunca fica com duas matrículas activas no mesmo ano — a própria base de dados impede.

**B. Ficheiros** — `prisma/schema.prisma` + migração `20261013220000_estrutura_escolar`, `src/server/modules/{estrutura,pessoas,matriculas}.ts`, `src/server/authz/scope.ts`, `src/server/erros.ts`, páginas em `src/app/(interno)/interno/{estrutura,estudantes}`, portais, `FormAcao.tsx`, seed, testes, docs (ADR-0002).

**C. Comandos e resultados reais (local)**
- `npm run lint`: 0 erros · `format:check`: ok · `typecheck`: 0 erros · `build`: ok
- `npm test`: **96 passaram, 0 falharam** (30 unitários + 66 integração com PostgreSQL)
- `npm run test:e2e`: **15 passaram, 0 falharam** (corrido 2 vezes)
- Mutação: 5 defesas removidas uma a uma → os testes falharam em todas; código reposto.
- CI no GitHub: ver adenda.

**D. Testes de permissão negativos** — ver o pedido de revisão (matrículas, estrutura, estudantes, escopo, e2e de acesso cruzado).

**E. Riscos / limitações** — `docs/security.md` §8. Em particular: a verificação da ligação não tem ainda anexo do documento; contas (D9) por decidir.

**F. Decisões provisórias** — ADR-0002 (NOVA/RENOVAÇÃO validadas, transferência só no mesmo ano, n.º de processo manual, BI mascarado…). **Pergunta ao PO (D9)** em aberto, feita com 3 opções.

**G. Próxima acção** — entregar `docs/revisoes/PEDIDO-REVISAO-ENTREGA-C.md` ao Codex. Paro aqui.
