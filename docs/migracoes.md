# Aplicar migrações numa base com dados (staging/produção)

Aplica-se sempre que `prisma/migrations/` tiver migrações novas e a base **já tiver dados reais**. Em desenvolvimento e no CI (bases vazias) não é preciso.

1. **Cópia de segurança** da base e confirmação de que se consegue restaurar (ver `docs/deployment.md`, Entrega H).
2. **Pré-verificação** (só lê, não altera): `npm run db:preflight`. Se listar registos, corrigi-los (anular ou corrigir a matrícula errada, pela interface, com auditoria) e repetir até dizer «OK».
3. **Aplicar**: `npm run db:deploy` (= `prisma migrate deploy`).
4. **Verificar**: `npx prisma migrate status` deve dizer que a base está actualizada; abrir a aplicação e correr o seed **só em desenvolvimento** (o seed recusa-se a correr em produção).
5. Se falhar a meio: não editar a migração; restaurar a cópia do passo 1, corrigir os dados e recomeçar.

## O que a pré-verificação cobre
| Migração | Verifica |
|---|---|
| `20261015100000_matricula_nova_unica` | Estudantes com mais de uma matrícula «Nova» activa/concluída |
| `20261013220000_estrutura_escolar` | Mais de uma matrícula activa por estudante e ano; mais de um ano lectivo ACTIVO |

Cada nova migração que acrescente um índice único ou uma restrição sobre dados existentes **deve acrescentar a sua verificação** a `scripts/preflight-migracoes.ts` (com teste).

## Papéis da base de dados (obrigatório em staging/produção)
Três papéis (ADR-0008): o **dono** (`ADMIN_DATABASE_URL`: migrações, seed, administração), `lamanus_app` (negócio; `DATABASE_URL`) e `lamanus_auth` (módulo de autenticação: sessões, login, recuperação; `AUTH_DATABASE_URL`).
1. **Criar os papéis da aplicação** (uma vez, como superutilizador): `psql -v app_password='<palavra-passe forte>' -v auth_password='<outra palavra-passe forte>' -f docker/db/papeis.sql`. Com o Docker Compose isto é feito na criação da base (`APP_DB_PASSWORD` e `AUTH_DB_PASSWORD`). Use palavras-passe **diferentes** para cada papel e guarde-as só no ambiente do servidor.
2. **Migrar como dono**: `ADMIN_DATABASE_URL` aponta para o dono das tabelas; `npm run db:deploy` aplica as migrações **e** os privilégios (`prisma/grants.sql`).
3. **A aplicação usa `DATABASE_URL` com o papel `lamanus_app`** (negócio) e **`AUTH_DATABASE_URL` com o papel `lamanus_auth`** (só `src/server/auth/*`), nunca o dono nem um superutilizador. Sem `AUTH_DATABASE_URL` o login falha de forma visível. Papéis e permissões (`Role`, `Permission`, `RolePermission`) só o dono os escreve: `npm run db:seed` (desenvolvimento) ou o passo de deploy que sincroniza `src/server/authz/permissoes.ts`.
4. Depois de cada migração nova, `npm run db:deploy` repete os privilégios (é idempotente).
5. Verificação rápida: com `lamanus_app`, `TRUNCATE "Nota"`, `ALTER TABLE "Nota" DISABLE TRIGGER nota_bloqueada`, `SELECT * FROM "Session"`, `SELECT "passwordHash" FROM "User"` e `DELETE FROM "UserRole"` têm de ser **recusados**; com `lamanus_auth`, `SELECT count(*) FROM "Nota"` também (o job `compose` do CI confirma tudo isto).
