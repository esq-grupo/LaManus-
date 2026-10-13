# ADR-0001 — Arquitectura técnica base

- **Data:** 2026-10-13
- **Estado:** Provisória (D1 pendente de aprovação E-ESQ)
- **Responsável:** Claude Code (construtor); aprovação: E-ESQ (PO)

## Contexto
Plataforma de gestão escolar para 20–50 utilizadores internos e 500–1.500 estudantes, em servidor próprio, com dados de menores e dados financeiros. A equipa de manutenção é pequena; o PO não é programador. Repositório de partida vazio (sem commits).

## Decisão
Confirmar a proposta da §5 do guião sem alterações:
TypeScript strict · Next.js (App Router) · PostgreSQL 16 · Prisma · Zod · sessões em base de dados (cookie httpOnly/secure/sameSite) com argon2 · RBAC + escopo de dados na camada única `src/server/authz` · Tailwind + shadcn/ui · Vitest + Playwright · Docker Compose + Caddy/Nginx com TLS · GitHub Actions. **Monólito modular**, sem microserviços.

## Afinamentos propostos (a validar na Entrega A)
1. **argon2id** em vez de bcrypt (password hashing); bcrypt só se houver problema de compilação no servidor.
2. **Sessões em BD** com token aleatório de 256 bits; só o hash é guardado; revogação imediata.
3. **Autorização por pedido**: nenhuma Server Action/Route Handler acede a dados sem passar por `authz.can()` + `authz.scope()`. Teste automático que falha se um handler não declarar a permissão exigida.
4. **Dinheiro**: `Int` em cêntimos (AOA). Encargos/pagamentos/estornos só por inserção; trigger de BD que bloqueia UPDATE/DELETE em `Pagamento`, `AlocacaoPagamento`, `Recibo`, `EventoAuditoria`.
5. **Numeração de recibos sem saltos**: tabela de sequência por série com `SELECT … FOR UPDATE` na mesma transacção que emite o recibo (não usar `SEQUENCE` do Postgres, que tem saltos).
6. **Integridade em BD** além da aplicação: CHECK, UNIQUE parcial (matrícula activa), FKs com índice.
7. **Ficheiros** em pasta fora da raiz pública; download por Route Handler que valida permissão a cada pedido.
8. **Sem gateways** de pagamento na 1.ª fase (D7).

## Alternativas consideradas
| Alternativa | Motivo de rejeição |
|---|---|
| Django/Laravel | Boas opções, mas duplicaria linguagem entre front e back; Zod/TS partilhados reduzem erros |
| NestJS + SPA separada | Dois projectos para operar; sem ganho para este volume |
| Auth.js/NextAuth | Menos controlo sobre revogação e bloqueio; sessões próprias são simples e testáveis |
| Microserviços | Complexidade operacional injustificada |

## Impacto
Um só repositório e uma só imagem Docker (+ Postgres). Ferramentas todas instaladas no ambiente de desenvolvimento (Node 22, npm 10, Docker 29, PostgreSQL 16 cliente).

## Pendente de confirmação
D1 (stack), D2 (servidor: especificações, SO, cópias externas de backup). Ver `docs/riscos.md`.
