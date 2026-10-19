# Pedido de revisão — Entrega H (Migração, instalação e continuidade)

Data: 2026-10-19 · Revisor: Codex · Veredicto a guardar em `docs/revisoes/VEREDICTO-ENTREGA-H.md`
Regra de comunicação com o PO: `docs/REGRAS-COMUNICACAO.md`.

## Âmbito e estado
H1 (isolamento: `lamanus_auth`, auditoria com origem), H2 (importador Excel), H3 (cópias cifradas, Compose de staging, Caddy/TLS), D11 (SMTP) e pré-verificação do servidor (`scripts/verificar-servidor.sh`) já foram revistos em separado: H1/H2/H3 e D11 **APROVADO COM RESSALVAS** (ver `docs/revisoes/VEREDICTO-ENTREGA-H*.md` no clone de revisão). Este pedido cobre o **conjunto** e o que é novo desde as últimas revisões.

## Novo desde as últimas revisões
- `scripts/verificar-servidor.sh` e `tests/unit/verificar-servidor.test.ts` (10 testes; mutação «palavras-passe iguais» detectada).
- `docs/guia-tecnico-servidor.md` e `docs/dossie-validacao-escola.md`.
- D11: `src/server/auth/smtp.ts`, `mailer.ts`, Compose e `.env.staging.example`.

## Como executar
```
cp .env.example .env && docker compose up -d db && npm ci
npm run db:generate && npm run db:preflight && npm run db:deploy && npm run verificar:privilegios && npm run db:seed
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e
bash scripts/testar-restauro.sh
```

## Evidência
CI verde à 1.ª tentativa em todos os commits desta entrega; último de código: `cfcf2a0` (execução 39317634681). Testes locais: 308 vitest (298 + 10) e 32 e2e.

## Atenção especial
1. Que o contentor `app` não recebe credenciais do dono (`docker-compose.staging.yml`, `tests/unit/staging.test.ts`).
2. Que `scripts/verificar-servidor.sh` nunca imprime segredos e recusa configurações perigosas.
3. Que a documentação para o técnico não induz a partilhar segredos nem a expor a base de dados.

## Fora do alcance (depende da escola, registado no dossiê)
Servidor e domínio reais; restauro e `verificar:privilegios` no servidor; Excel reais e reconciliação assinada; SMTP real; Android e iPhone reais; aceitação por papéis.
