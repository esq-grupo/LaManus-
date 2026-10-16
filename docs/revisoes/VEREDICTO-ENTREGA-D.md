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


---

# Revisão n.º 2 — REPROVADO (resumo entregue pelo PO)

Os dois contornos anteriores foram corrigidos e o CI passou na execução 38817168336. **Achado novo:** `lamanus_app` pode chamar directamente `corrigir_nota_publicada` e fornecer o UUID de uma pessoa da Direcção como autor. A função verifica o estado da pauta, o valor e o motivo, mas não verifica a identidade nem a permissão do autor; uma chamada SQL directa pode corrigir uma nota e atribuir falsamente a acção à Direcção.

## Resposta do construtor (revisão 2)
| # | Resposta | Onde |
|---|---|---|
| 1 | **Aceite — e era pior.** Reproduzido primeiro com testes que falhavam: a função aceitou **até o UUID de um docente** como autor. A função deixou de ter o argumento «autor»: recebe o **token da sessão**, valida-o ela própria (sessão existente, não revogada, dentro do prazo e de inactividade de 30 min, utilizador activo), confirma que o utilizador tem a permissão `notas:corrigir` através dos seus papéis e **deduz o autor** da sessão; a auditoria regista o autor e o `sessaoId` (nunca o token). A BD guarda só o SHA-256 do token: **ler o hash da tabela `Session` não serve de credencial** (testado). | migração `20261016210000_corrigir_nota_com_sessao`, `pautas.ts`, `dal.ts` |
| Testes | Com a ligação da aplicação: token inventado/curto/nulo; hash lido de `Session`; sessão válida **sem** permissão (os 8 papéis); sessão revogada, expirada, inactiva e conta desactivada; a forma antiga da chamada (UUID de Direcção ou de docente) já não existe; o autor registado é o dono do token; o token nunca está na auditoria. Mutações (função reposta e conferida por soma de verificação): sem verificar a permissão (2 falhas), sem validar a sessão (1), aceitar o hash como credencial (4). | `bd-contorno.test.ts` |
| Erro meu apanhado a tempo | Ao mudar a assinatura, o TypeScript não distinguiu o `ip` do `tokenSessao` (ambos `string \| null`) e a acção da interface passaria o IP como token. O aviso de «variável não usada» do lint denunciou-o antes de enviar. O contrato passou a um objecto nomeado `{ tokenSessao, ip }` (não se pode trocar) e o teste ponta-a-ponta da correcção pela interface confirma o caminho real do cookie. | `pautas.ts`, `acoes-avaliacao.ts` |
| Limite reconhecido | A aplicação tem de poder criar sessões e papéis para funcionar; um atacante com SQL arbitrário *com o papel da aplicação* poderia inserir uma sessão para si. A defesa cobre o erro e o abuso comuns e deixa rasto (`sessaoId`: sessão sem `LOGIN_OK` correspondente é detectável). Defender o comprometimento total do papel exige funções próprias para criar sessões e auditar — registado como evolução (Entrega H). Operação: não activar o registo de parâmetros de consultas no PostgreSQL de produção (o token é um parâmetro). | ADR-0003 (decisão 13), `docs/security.md` §9.2 |

Pedida revisão n.º 3.
