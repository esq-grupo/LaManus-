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

**F. Decisões provisórias** — ADR-0002 (NOVA/RENOVAÇÃO validadas, transferência só no mesmo ano, n.º de processo manual, BI mascarado…). **D9 decidida pelo PO** (3 opções): só o Admin técnico cria contas.

**G. Próxima acção** — entregar `docs/revisoes/PEDIDO-REVISAO-ENTREGA-C.md` ao Codex. Paro aqui.

### Adenda — CI no GitHub
Execução [38471439069](https://github.com/esq-grupo/LaManus-/actions/runs/38471439069), commit `252a0f0`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`; 96 testes de unidade/integração e 15 e2e).

### Adenda — revisão n.º 2 (2026-10-15)
Correcções ao REPROVADO da revisão 1 (4 achados); resposta ponto a ponto em `VEREDICTO-ENTREGA-C.md`.
- Local: 31 unitários + 79 integração + 17 e2e a passar; lint, formatação, typecheck e build sem erros; suite repetida com dois fusos horários extremos.
- Mutações detectadas pelos testes (filtro do Docente, UTC em vez de Luanda, índice da «Nova», auditoria depois do commit).
- CI: ver adenda seguinte após o push.
- CI: execução [38810347287](https://github.com/esq-grupo/LaManus-/actions/runs/38810347287), commit `1bc650a`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`; inclui 110 testes de unidade/integração e 17 e2e).
