# Pedido de revisão — Entrega 0 (Auditoria e plano)

Data: 2026-10-13 · Revisor: Codex · Veredicto esperado em `docs/revisoes/VEREDICTO-ENTREGA-0.md`

## Objectivo e critérios de aceitação (§9)
Inspeccionar repositório/ferramentas; confirmar arquitectura (ADR-0001); requisitos (confirmado vs pressuposto); modelo de dados (ER Mermaid) e segurança (matriz); especificação de migração Excel; riscos e decisões pendentes.
**Aceitação:** documentos criados; **nenhum código de produto**; relatório no formato da §13 do `CLAUDE.md` (secção 8 do manual do Codex).

## Ficheiros
- `docs/ESTADO.md`
- `docs/decisions/ADR-0001-arquitectura.md`
- `docs/requirements.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/migration-excel.md`
- `docs/riscos.md`
- `docs/revisoes/RELATORIO-ENTREGA-0.md`

Commits: ver `git log` na branch `claude/guiao-mestre-la-manu-ulr5uq`.

## Como verificar
```
git log --stat
find . -path ./.git -prune -o -type f -print     # só devem existir ficheiros em docs/
```
Testes: não aplicável (sem código). Os diagramas Mermaid de `docs/data-model.md` devem renderizar no GitHub.

## Atenção especial
1. Constraints de integridade financeira (recibos sem saltos, imutabilidade por trigger, estorno com dupla aprovação) em `data-model.md` e ADR-0001 §4–5.
2. Separação de funções do Admin técnico e regras de escopo S1–S8 em `security.md`.
3. Matriz de permissões: algum recurso falta (ex.: notificações, relatórios)?
4. Passagem de bcrypt para argon2id e sessões em BD: aceitável?
5. Plano de migração: saldos iniciais como encargos de abertura.

## Limitações
- Sem ficheiros Excel, sem especificações do servidor, sem decisões da escola (todas as D1–D14 provisórias).
- `AGENTS.md` e `CLAUDE.md` não estão no repositório (R10); o construtor não conhece o formato exacto esperado do veredicto.
