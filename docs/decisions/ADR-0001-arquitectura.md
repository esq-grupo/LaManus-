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
4. **Dinheiro**: `BigInt` em cêntimos (AOA), apresentado em Kz inteiros (`docs/data-model.md` §2.1). Encargos/pagamentos/estornos só por inserção; trigger de BD que bloqueia UPDATE/DELETE em `Pagamento`, `AlocacaoPagamento`, `Recibo`, `EventoAuditoria`.
5. **Numeração de recibos sem saltos**: tabela de sequência por série com `SELECT … FOR UPDATE` na mesma transacção que emite o recibo (não usar `SEQUENCE` do Postgres, que tem saltos).
6. **Integridade em BD** além da aplicação: CHECK, UNIQUE parcial (matrícula activa), FKs com índice.
7. **Ficheiros** em pasta fora da raiz pública; download por Route Handler que valida permissão a cada pedido.
8. **Sem gateways** de pagamento na 1.ª fase (D7).

## Custos e limites operacionais (estimativa; valores desconhecidos marcados PENDENTE)
**Pressupostos de carga:** 1.500 estudantes + ~3.000 encarregados + 50 internos; picos (notas publicadas, vencimentos de propinas) estimados em 100–200 utilizadores simultâneos; base de dados < 5 GB no 1.º ano; documentos/PDF < 20 GB/ano.

**Capacidade mínima proposta para o servidor** (a validar na D2): 4 vCPU, 8 GB RAM, 200 GB SSD, Linux LTS. **Hipótese inicial sem validação**: não há medições nem teste de carga; dimensionamento por experiência com aplicações web de dados relacionais deste porte. Validar na Entrega A/F com teste de carga (ex.: 200 utilizadores simultâneos nas rotas de login, pauta e extracto) **antes** de a escola contratar ou comprar o servidor.

| Item de custo | Stack proposta | Alternativa gerida (nuvem) | Notas |
|---|---|---|---|
| Licenças de software | 0 (todo open source) | 0 | Next.js, PostgreSQL, Prisma, Caddy, Docker |
| Servidor | Hardware da escola ou VPS: PENDENTE | Instância gerida: PENDENTE | Preço depende do fornecedor |
| Ligação à Internet / energia / UPS | PENDENTE (escola) | n/a | Risco R4: falha de energia/ligação afecta o acesso |
| Domínio e certificado TLS | Domínio: PENDENTE; TLS gratuito (Let's Encrypt) | idem | D13 |
| Email transaccional | Serviço SMTP: PENDENTE (volume baixo) | idem | D11 |
| Armazenamento de backups externos | ~2× tamanho da BD + documentos; PENDENTE | idem | Retenção 30 diários + 12 mensais (proposta) |
| Operação e manutenção | Horas E-ESQ/mês para actualizações de segurança, monitorização e restauro: PENDENTE | Menos horas de infraestrutura | Decisão de contrato com a escola |

**Limites conhecidos:** instância única (sem alta disponibilidade) → indisponibilidade durante manutenção/reinício; RPO ≤ 24 h; sem escala horizontal na 1.ª fase; geração de PDF em lote em horas de pico deve correr em fila assíncrona; ligações lentas tratadas com SSR e páginas leves.

**Conclusão:** custo de software nulo; o custo real está no servidor, ligação, backups externos e horas de operação — todos PENDENTES de D2 e acordo comercial.

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
