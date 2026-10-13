# Checkpoint — Entrega A (Fundação técnica) — 2026-10-13

- **Resultado:** fundação técnica pronta; sem login real nem dados reais.
- **Revisão Codex:** n.º 1 REPROVADO (Compose não verificado) → n.º 2 REPROVADO (viu tentativa de CI falhada por rede) → n.º 3 **APROVADO**.
- **Evidência:** CI verde nos commits `8cd9f7a` e `1599624` (jobs `verificar` e `compose`).
- **Entregue:** Next.js 16 + TypeScript estrito, Tailwind 4, Prisma 7 + PostgreSQL 16, migração inicial, seed fictício idempotente, 3 áreas + login vazio, `dinheiro.ts` (cêntimos `BigInt`), 5 testes unitários + 2 E2E, CI, README.
- **Lições:** validar YAML antes do push; o CI deve repetir `npm ci` (rede).
- **Pendências (baixas):** avisos de Node 20 nas Actions e `eslint@9`; P1 (guardar CLAUDE.md/AGENTS.md no repo); P3 (unidade monetária, ainda provisória); nomes dos responsáveis dos riscos; Mermaid por verificar no GitHub; teste de carga do servidor (Entrega F).
- **Próxima entrega:** B — Identidade e segurança, só após OK do PO.
