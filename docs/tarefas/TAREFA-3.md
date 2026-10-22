# TAREFA-3 — Página de auditoria (só leitura)

Zona: **amarela** (nova rota e novo módulo de leitura; sem escrita, sem migrações, sem tocar em `src/server/auth/*` nem em `prisma/*`). **Antes de codificar**, o Manus envia ao Revisor uma nota de desenho de ≤ 10 linhas e espera a aprovação (§6 do `docs/PROTOCOLO-MANUS.md`).
Ramo: `manus/TAREFA-3-pagina-auditoria`. Pull request para o ramo por omissão; **sem fundir**. Depende de a TAREFA-2 estar fechada só no sentido de não editarem os mesmos ficheiros: se a TAREFA-3 tocar em `FormAcao.tsx` ou `estrutura/page.tsx`, avisar.

## Objectivo
A permissão `auditoria:ver` já existe (Direcção, Qualidade e Administrador técnico) mas não há ecrã. Quem controla a escola precisa de ver «quem fez o quê e quando», sem pedir à equipa técnica.

## Estado actual (referência)
- Tabela `EventoAuditoria` (`prisma/schema.prisma`): `actorId`, `acao`, `entidade`, `entidadeId`, `antes`, `depois`, `ip`, `em`, `origem` (`BD` = escrita pela base de dados; `APP` = pela aplicação). Só de inserção; `lamanus_app` pode **ler** (SELECT) mas não alterar.
- Não há relação Prisma de `actorId` para `User`: o nome do autor obtém-se por consulta aos utilizadores (a app só lê as colunas permitidas; **nunca** `passwordHash`).
- Ações existentes (lista em `src/server/audit` e usos): `LOGIN_OK`, `LOGIN_FALHADO`, `ACESSO_NEGADO`, `ESTUDANTE_CRIADO`, `MATRICULA_TRANSFERIDA`, `PAUTA_PUBLICADA`, `DECLARACAO_EMITIDA`, `RECIBO_DESCARREGADO`, `SESSOES_REVOGADAS`, etc.

## Resultado esperado (critérios de aceitação)
1. Rota **`/interno/auditoria`**, protegida por `exigirPermissao("auditoria:ver")` no servidor; o módulo novo `src/server/modules/auditoria.ts` repete a verificação (`exigir(actor, "auditoria:ver")`). Quem não tem a permissão recebe a mesma resposta que nas outras páginas protegidas.
2. Lista **mais recente primeiro** (`em` desc, `id` desc como desempate), **50 por página**, com a mesma paginação da lista de utilizadores (`?pagina=`, leitura segura `/^\d{1,6}$/`, última página limitada antes do `skip`, ligações sem JavaScript que preservam os filtros, `nav` com `aria-label`, alvos ≥ 44 px).
3. Colunas: data e hora (fuso **Africa/Luanda**, formato português), **acção** (rótulo legível em português para as acções conhecidas; o código técnico como fallback), **autor** (nome e email; «sistema» se `actorId` nulo; «conta removida» se já não existir), **entidade** e identificador **abreviado** (primeiros 8 caracteres, completo em `title`), **origem** (BD/APP) e **IP**.
4. Filtros por `GET` (sem JavaScript): **acção** (selector com as acções existentes), **autor** (texto: nome ou email, ≤ 80 caracteres), **entidade** (texto exacto), **de/até** (datas `AAAA-MM-DD`, inclusive, interpretadas em Africa/Luanda; datas inválidas ignoradas). Os filtros combinam-se e mantêm-se ao paginar.
5. **Não mostrar `antes` nem `depois`** nesta versão (podem conter dados pessoais); nem segredos, nem hashes, nem tokens. Nenhuma coluna ou campo de `User` além de `id`, `nome` e `email`.
6. **Só leitura:** sem exportação, sem apagar, sem editar. (Exportar exigiria auditar a própria exportação: fica para outra tarefa.)
7. Ligação **«Auditoria»** na barra e atalho no início da área interna **só** para quem tem `auditoria:ver` (alterar `src/app/(interno)/layout.tsx` e `interno/page.tsx` seguindo o padrão já usado para os outros).
8. Texto em português europeu; utilizável no telemóvel (tabela com rolagem horizontal contida ou cartões; sem rolagem horizontal da página).
9. Sem migrações, sem novas dependências, sem alterações a ficheiros protegidos.

## Testes exigidos (teste primeiro)
- **Integração** (`tests/integration/auditoria.test.ts`): permitidos Direcção, Qualidade e Administrador técnico; **recusados** Secretaria, Financeiro, Docente, RH, Estudante e Encarregado; filtro por acção, por autor, por entidade e por intervalo de datas (incluindo fronteira do dia em Africa/Luanda); paginação sem repetir nem omitir (`limite` pequeno); parâmetros inválidos; o resultado **não contém** `antes`/`depois`; o nome do autor aparece e «sistema» quando `actorId` é nulo. Criar eventos de teste por funções legítimas ou pelo dono nos testes e limpar no fim (a tabela só aceita inserção para a app: usar a ligação de administração dos testes como as outras suites).
- **e2e** (`tests/e2e/auditoria.spec.ts`): Direcção vê a página, aplica um filtro e muda de página com o filtro preservado; Docente é recusado; a barra mostra «Auditoria» só a quem pode.
- Mostrar que os testes **falham antes** da implementação. Para a recusa por permissão, fazer **mutação**: retirar a verificação no módulo, ver o teste falhar, repor (conferir com `cmp`).

## Fora do âmbito
Mostrar `antes`/`depois`; exportação; alertas; integridade/cadeia de hashes da auditoria (é a TAREFA-4); alterar o que se audita; mexer em `src/server/audit/index.ts`.

## Entrega
Relatório do §8 do protocolo, com comandos e números reais e o hash de **40 caracteres** do commit. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>».
