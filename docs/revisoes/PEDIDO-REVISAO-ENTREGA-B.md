# Pedido de revisão — Entrega B (Identidade e segurança)

Data: 2026-10-13 · Revisor: Codex · Veredicto em `docs/revisoes/VEREDICTO-ENTREGA-B.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md` (3 opções, recomendada primeiro).

## Objectivo e aceitação (CLAUDE.md §9)
Modelo User/Role/Permission/Session; login/logout; bloqueio após tentativas falhadas; recuperação de conta; política de passwords; camada `authz` (`can`, `scope`); protecção de rotas por área; gestão de utilizadores (Admin técnico); auditoria de login, alteração de papéis e falhas de acesso.
**Aceitação:** testes provam que cada papel só acede ao permitido; sessão revogada deixa de funcionar imediatamente; cookies seguros.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:deploy && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
```
(`test:e2e` precisa de `SEED_PASSWORD` no `.env` e de `npx playwright install chromium`.)
Contas de desenvolvimento (fictícias): `<papel>@exemplo.lamanu.test`, p.ex. `docente@…`, `admin.tecnico@…`; palavra-passe = `SEED_PASSWORD`.

## Testes (resultado local)
- Unitários `tests/unit/` — 29: matriz de permissões (negativos por papel), áreas, separação de funções, escopo de estudantes, política de passwords, argon2id, tokens, sanitização da auditoria, dinheiro.
- Integração `tests/integration/` — 24 contra PostgreSQL real: login, enumeração, bloqueio por conta e por IP, contas inactivas, token não guardado em claro, sessão revogada/expirada/inactiva, efeito imediato de papéis, recuperação completa (uso único, expiração, política, sessões revogadas, não desbloqueia), gestão de utilizadores (negativos para os 8 papéis não-admin), auditoria imutável (UPDATE/DELETE/TRUNCATE falham).
- E2E `tests/e2e/` — 8: anónimo → login; erro genérico; docente fora do portal do estudante e da gestão; estudante/encarregado presos ao seu portal; Direcção vê mas não gere; cookie httpOnly + logout + cookie antigo inútil; fluxo do administrador (criar → convite → definir password → entrar; auto-alteração bloqueada).
- **Validação dos testes (mutação manual):** removi a verificação de revogação da sessão → 2 testes falharam; dei `financeiro:ver` ao Admin técnico → 1 teste falhou. Código restaurado.

## Atenção especial
1. `src/server/auth/sessao.ts` e `login.ts`: ordem das verificações, bloqueio, auditoria, tempo igualado.
2. `src/server/authz/`: catálogo vs. matriz de `docs/security.md`; negar por omissão; `scope.ts`.
3. `src/server/modules/utilizadores.ts`: separação de funções (auto-alteração), admin nunca vê passwords.
4. `proxy.ts` é só optimista; a decisão real está em `dal.ts` (`exigirArea`/`exigirPermissao`) — confirmar que nenhuma rota/ação fica sem verificação.
5. Migração `20261013210000_identidade_seguranca` (trigger de auditoria imutável).
6. Limitações conhecidas em `docs/security.md` §7 (CSP sem script-src, X-Forwarded-For, timing da recuperação, sem MFA, sem limpeza agendada).

## Limitações
Escopos de Encarregado e Docente são "negar tudo" até às Entregas C/D (entidades ainda não existem). Sem SMTP real (D11). CI verde no commit `16a9dbb` (execução 38467073949, tentativa 1): https://github.com/esq-grupo/LaManus-/actions/runs/38467073949

## Revisão n.º 2
Corrige os dois achados da revisão 1 (bloqueio não atómico; falha de email na recuperação). Resposta ponto a ponto em `VEREDICTO-ENTREGA-B.md`. Testes locais: 58 de unidade/integração (29 + 29) e 8 e2e, todos a passar. Atenção especial: `src/server/auth/login.ts` (reserva atómica antes de verificar), `recuperacao.ts` (nunca lança) e os testes de rajada. CI verde no commit `cd2dafb`: https://github.com/esq-grupo/LaManus-/actions/runs/38468737152
