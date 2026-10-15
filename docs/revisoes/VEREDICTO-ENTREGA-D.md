# Veredicto — Entrega D — revisão n.º 1 (resumo entregue pelo PO)

## Resultado: REPROVADO
CI verde (execução 38813755295), mas dois caminhos de SQL directo contornam o bloqueio das pautas:
1. A variável `app.permitir_correcao`, usada pelos gatilhos para autorizar correcções, pode ser definida por qualquer ligação à BD com `set_config`.
2. Uma nota ou avaliação pode ser movida de uma pauta bloqueada para outra em rascunho, porque o gatilho verifica apenas a pauta de destino.

O ficheiro original está no clone local do Codex (sem push); este resumo guarda o resultado no repositório. Tenho apenas o resumo.

## Resposta do construtor
| # | Resposta | Onde |
|---|---|---|
| 1 | **Aceite — e a correcção é estrutural.** Reproduzido primeiro com testes que falhavam. O problema não era só o nome da variável: qualquer interruptor que a própria ligação da aplicação possa accionar é contornável. Passa a haver **duas identidades na BD**: o **dono** das tabelas (migrações, seed, administração) é o único que os gatilhos deixam contornar (decisão pela identidade `current_user`, não por variável) e a **aplicação corre com o papel restrito `lamanus_app`** (sem ser dona: não desliga gatilhos, não apaga índices, não faz `TRUNCATE`, não assume outro papel, não altera a auditoria nem apaga pautas). A correcção de notas publicadas é a função privilegiada `corrigir_nota_publicada` (`SECURITY DEFINER`), que valida (pauta publicada, valor, motivo, valor diferente) e audita na mesma transacção. A variável `app.permitir_correcao` foi **eliminada**. O CI cria o papel e prova, no job `compose`, que a aplicação é recusada em `TRUNCATE`, `DISABLE TRIGGER`, `SET ROLE` e `DELETE` na auditoria. | migrações `20261016200000_blindar_pautas`, `docker/db/papeis.sql`, `prisma/grants.sql`, `pautas.ts`, CI |
| 2 | **Aceite.** O gatilho verifica a pauta **antiga e a nova** e as chaves passam a ser **imutáveis** (nota: avaliação e estudante; avaliação: disciplina, turma, período e ano). Testado com o destino livre, para que só o gatilho possa travar (dois testes meus passavam por acaso, por colidirem com a unicidade; reescritos). | migração, `bd-contorno.test.ts` |
| Extra | Ao rever por mim, encontrei **outros vectores do mesmo tipo**, agora fechados e testados: inserir uma pauta já `PUBLICADA` directamente (exporia as notas aos portais), alterar outras colunas de uma pauta publicada, mudar as chaves de uma pauta, `TRUNCATE` (que ignora gatilhos de linha). | migração, testes |
| Regressão minha, apanhada pela suite | O primeiro gatilho novo falhava em todas as notas em rascunho (`record "new" has no field`): em PL/pgSQL `TG_TABLE_NAME = 'X' AND NEW.campoDeX` não protege a leitura do campo. Corrigido com `IF` aninhados; a migração ainda não tinha sido enviada, por isso corrigi-a no sítio e validei que aplica do zero numa base nova. | migração |
| Validação | Mutações na BD (cada uma desfeita no fim, com as definições repostas e conferidas por soma de verificação): interruptor por variável (2 falhas), gatilho só no destino e chaves mutáveis (3), pauta pode nascer publicada (3), função sem exigir pauta publicada (1). | — |

Pedida revisão n.º 2.
