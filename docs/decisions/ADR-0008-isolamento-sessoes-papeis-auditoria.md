# ADR-0008 — Isolamento de sessões, papéis e auditoria (Entrega H)

Estado: aceite (provisório até ao OK do PO) · 2026-10-20 · fecha a decisão 13 do ADR-0003 (trabalho obrigatório da Entrega H)

## Problema
Quem conseguisse correr SQL arbitrário com o papel `lamanus_app` podia criar sessões (e assim passar por qualquer pessoa), alterar papéis e permissões, e falsificar a auditoria. Todas as defesas «autenticadas pela sessão» (notas, dinheiro, declarações) dependiam, em última análise, de dados que a própria aplicação podia escrever.

## Decisões
1. **Três papéis na base de dados.** `lamanus` (dono: migrações, seed, administração), `lamanus_app` (negócio: notas, finanças, pessoas…) e **`lamanus_auth`** (módulo de autenticação: sessões, tentativas de login, recuperação de palavra-passe). O código de autenticação (`src/server/auth/*`) usa uma ligação própria (`AUTH_DATABASE_URL`); o resto da aplicação não consegue tocar em sessões.
2. **A palavra-passe continua a ser verificada na aplicação (argon2id)**, dentro do módulo de autenticação. Não se passa a palavra-passe em claro à base de dados (ficaria em registos de consultas) nem se troca por um algoritmo mais fraco disponível no PostgreSQL. Custo aceite: o módulo de autenticação, que é pequeno, é a parte a defender com mais cuidado.
3. **`lamanus_app` perde**: qualquer acesso a `Session`, `PasswordReset` e `TentativaLogin`; escrita em `User`, `UserRole`, `Role`, `Permission` e `RolePermission`; leitura da coluna `passwordHash`; inserção directa em `EventoAuditoria`.
4. **Gestão de contas e papéis só por funções da BD** (`criar_utilizador`, `definir_papeis`, `definir_estado_utilizador`, `revogar_sessoes_utilizador`), que autenticam o autor pelo **token da sessão** (permissão `utilizadores:gerir`), impedem alterar os próprios papéis/estado e auditam na mesma transacção. Permissões e papéis (`Role`/`Permission`/`RolePermission`) só os escreve o dono (no `db:deploy`).
5. **Auditoria com origem.** `EventoAuditoria.origem`: `BD` = escrito por funções da BD que autenticaram o autor pela sessão (dinheiro, correcção de notas, contas e papéis) — **a aplicação não o consegue forjar**; `APP` = relatado pela aplicação (`registar_evento_app`, hora fixada pelo servidor). Falsificar o **autor** de um evento `APP` continua possível a quem tenha SQL na ligação `lamanus_app`; por isso as acções críticas são `BD`.
6. **Limite que permanece** (declarado): quem controle o processo da aplicação inteiro (e portanto ambas as ligações) ou o dono da base de dados. A protecção cobre o cenário realista: comprometimento da ligação de negócio (SQL injection, consulta mal construída).

## Consequências
- Novas variáveis: `AUTH_DATABASE_URL` e `AUTH_DB_PASSWORD` (`docker/db/papeis.sql`, `.env.example`, CI, `docs/migracoes.md`).
- Testes de ataque com a ligação `lamanus_app` a provar que sessões, papéis, permissões, `passwordHash` e inserção directa de auditoria estão fora do alcance; testes das funções (token inválido/expirado, sem permissão, alterar os próprios papéis).
