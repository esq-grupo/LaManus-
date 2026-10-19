## Relatório — Entrega G — 2026-10-19

**A. O que foi feito**
Estudantes e encarregados pedem declarações (matrícula, frequência, situação financeira) pelo portal, ou a Secretaria regista o pedido. A Direcção aprova ou rejeita (com motivo); a Secretaria emite o PDF com número sequencial e código de verificação. Quem aprova nunca é quem emite. O documento emitido não muda mesmo que os dados do estudante mudem depois, e só se descarrega com sessão e permissão. O requerente recebe avisos e cada passo fica auditado.

**B. Ficheiros** — migração `20261019100000_pedidos_documentos`, `src/lib/declaracoes.ts`, `src/server/modules/{declaracoes,declaracao-pdf,notificacoes}.ts`, `src/app/{acoes-pedidos.ts,declaracoes/**}`, páginas de pedidos (interno e portais), `src/components/PedidosPortal.tsx`, testes, ADR-0006, docs.

**C. Comandos e resultados reais (local)**
- `lint`: 0 erros · `format:check`: ok · `typecheck`: 0 erros
- `npm test`: **257 passaram** (50 unitários + 207 integração), duas execuções seguidas
- `npm run test:e2e`: **28 passaram**
- Mutações: 4 defesas desligadas → testes falharam em todas; reposto.

**D. Testes de permissão negativos** — ver o pedido de revisão (9 papéis; acesso cruzado; controlo duplo).

**E. Riscos / limitações** — `docs/security.md` §12.

**F. Decisões do PO (3 opções, recomendada primeiro)** — tipos de declaração: matrícula, frequência e situação financeira; «contas em dia»: sem valores em atraso.

**G. O que correu mal pelo caminho** — nada de relevante nesta entrega; o ambiente local (PostgreSQL) parou entre sessões e foi reposto antes de cada verificação.

**H. Próxima acção** — CI e entrega ao Codex.

### Adenda — CI no GitHub
Execução [39258297356](https://github.com/esq-grupo/LaManus-/actions/runs/39258297356), commit `c10af58`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`), sem repetição.
