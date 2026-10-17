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
