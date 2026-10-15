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
