# Checkpoint — Entrega F (Portais) — 2026-10-18

**Estado:** implementada; a aguardar CI, revisão do Codex e OK do PO.

- Portal do estudante e do encarregado em cartões (mobile-first): notas publicadas, contas, recibos em PDF, avisos com contador de não lidos.
- Encarregado com vários educandos: selector e endereço próprio por educando; acesso cruzado → 404.
- Avisos (`Notificacao`) gerados na publicação da pauta, na correcção de nota e na emissão do recibo.
- Testes (local): 50 unitários + 187 integração + 27 e2e; Lighthouse móvel 0,97–0,99 / acessibilidade 1,00.
- Migração `20261018100000_portais_notificacoes`.
- Pendente: revisão do Codex e OK do PO; TLS e carga na Entrega H.
