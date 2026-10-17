# Checkpoint — Entrega E (Financeiro base) — 2026-10-17

**Estado:** implementada; a aguardar CI, revisão do Codex e OK do PO.

## O que existe
- Tipos de encargo; geração mensal em lote (idempotente); encargo avulso; anulação com motivo.
- Pagamento em dois passos: o Financeiro regista; a Direcção (outra pessoa) confirma → alocação automática ao encargo mais antigo (ou manual) e recibo `R/ano/n.º` sem saltos, com PDF.
- Estorno: o Financeiro propõe; a Direcção (outra pessoa) aprova → movimento inverso (primeiro o crédito, depois os encargos mais recentes). Parcial permitido; `ESTORNADO` só quando totalmente estornado.
- Saldo calculado (em dívida, em atraso, crédito); extracto por estudante (interno, portal do estudante e do encarregado); relatórios (dívidas por turma, recebimentos por período) e verificação de coerência das contas.

## Como se garante
Ver `docs/security.md` §10 e `docs/decisions/ADR-0004-financeiro.md`. Migrações `20261017100000_financeiro` e `20261017110000_estorno_ordem_determinista`.

## Testes (local)
48 unitários + 178 integração + 24 e2e, todos a passar; lint, formatação, tipos e compilação sem erros; migrações aplicam do zero numa base nova.

## Pendente
- Decisão de negócio do PO: **quem confirma pagamentos** (provisório: Direcção, ≠ quem registou).
- Entrega H (obrigatória): isolar sessões, papéis e auditoria (ADR-0003, decisão 13).
