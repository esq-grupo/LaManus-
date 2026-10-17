## Relatório — Entrega E — 2026-10-17

**A. O que foi feito**
A escola pode definir tipos de encargo (ex.: propina mensal), gerar as propinas de um mês para todos os estudantes matriculados (repetir não duplica), registar pagamentos (totais ou parciais) e aplicá-los ao encargo mais antigo. O Financeiro regista; a Direcção (outra pessoa) confirma, e só então o pagamento conta e é emitido o recibo em PDF com número sequencial sem saltos. Os erros corrigem-se por estorno, proposto pelo Financeiro e aprovado pela Direcção. Há extracto por estudante (também nos portais), relatórios de dívidas por turma e recebimentos por período, e uma verificação automática de que as contas batem certo.

**B. Ficheiros** — migrações `20261017100000_financeiro` e `20261017110000_estorno_ordem_determinista`, `prisma/{schema.prisma,grants.sql,seed.ts}`, `src/lib/financeiro.ts`, `src/server/modules/{financeiro,recibo-pdf}.ts`, `src/server/authz/{permissoes,scope}.ts`, `src/app/(interno)/interno/financeiro/**`, `src/app/recibos/**`, `src/components/ExtractoFinanceiro.tsx`, portais, testes, ADR-0004, docs.

**C. Comandos e resultados reais (local)**
- `lint`: 0 erros · `format:check`: ok · `typecheck`: 0 erros · `build`: ok
- `npm test`: **226 passaram, 0 falharam** (48 unitários + 178 integração), duas execuções seguidas
- `npm run test:e2e`: **24 passaram** (o e2e financeiro também 3 vezes seguidas)
- Mutações: 3 conjuntos de defesas desligadas → testes falharam em todos; código reposto (md5 igual).
- Migrações aplicam do zero numa base nova.

**D. Testes de permissão negativos** — ver o pedido de revisão (9 papéis × cada operação, escopo de leitura, sessão inválida/expirada/revogada, controlo duplo).

**E. Riscos / limitações** — `docs/security.md` §10.

**F. Decisões e pergunta ao PO** — ADR-0004. Pergunta pendente (3 opções): quem confirma pagamentos.

**G. O que correu mal pelo caminho**
1. Um validador de valores deixava passar texto inválido para uma conversão e rebentava com erro técnico; apanhado pelos testes e corrigido antes de enviar.
2. A ordem do estorno era ambígua (teste intermitente); reproduzido e corrigido com migração própria.
3. Um teste e2e falhou na suite completa mas não isolado: esperava uma mensagem num elemento que a página já tinha removido; corrigido para verificar o resultado, 3/3 depois.
4. Cometi um `commit` local com erros de tipos por encadear mal os comandos; detectei logo, corrigi e emendei antes de enviar.

**H. Próxima acção** — CI e entrega ao Codex.

### Adenda — CI no GitHub
Execução [39067579076](https://github.com/esq-grupo/LaManus-/actions/runs/39067579076), commit `6b62569`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`).

### Adenda — revisão n.º 1 do Codex (2026-10-17)
Achado: ordem do estorno parcial (ver `VEREDICTO-ENTREGA-E.md`). Corrigido em `227370a` (migração `20261017120000_estorno_ordem_cronologica`), com teste reproduzido a falhar antes. Local: 227 testes de unidade/integração a passar.

CI da execução [39069029627](https://github.com/esq-grupo/LaManus-/actions/runs/39069029627), commit `227370a`:
- **Tentativa 1: falhou** no passo `npm test` do job `verificar` (o job `compose` passou). Não consegui identificar o teste: o log acessível só tinha os registos do PostgreSQL, e o descarregamento do zip é bloqueado pelo proxy. Não reproduzi a falha localmente.
- **Tentativa 2** (repetição dos jobs falhados, uma só vez): **success** (`verificar` e `compose`).
- Conclusão honesta: um teste intermitente, não identificado, falhou uma vez no CI. Já havia dois intermitentes por investigar em `avaliacao.test.ts` (`docs/ESTADO.md`); este pode ser um deles. Investigá-los fica como pendência antes da Entrega H.

### Adenda — revisão n.º 2 do Codex (2026-10-17)
Achado: falso positivo no teste de privacidade dos portais (`1777` dentro de um UUID). Resposta em `VEREDICTO-ENTREGA-E-v2.md`.
- `contemValor` (número isolado, nunca pedaço de um identificador) em `notas-visibilidade.test.ts` e no e2e `avaliacao.spec.ts`, com testes próprios; mutação (filtro `PUBLICADA` desligado) → 4 testes falharam; ficheiro reposto e conferido por `md5`.
- Causa raiz de outros intermitentes: `Cenario.classe()` sorteava a `Classe.ordem` (única) em 100 000 valores → colisões aleatórias (`Classe_ordem_key`), cerca de 1 em 4 execuções completas. Intervalo alargado. **Local: 0 falhas em 16 execuções completas** (antes: 3 falhas em 12 execuções, em testes diferentes).
- CI: execução [39071990746](https://github.com/esq-grupo/LaManus-/actions/runs/39071990746), commit `2a3f5fa`, **tentativa 1: success** (jobs `verificar` e `compose`), sem repetição.
