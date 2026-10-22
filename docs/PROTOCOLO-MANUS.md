# Protocolo de produção: Manus executa, Claude revê e aprova, Claude Code publica

Em vigor desde 2026-10-20 (decisão do PO). Este documento é a ordem de serviço do **Manus**: ele é um **executor**. Não decide arquitectura, não aprova o seu próprio trabalho, não publica e não tem acesso ao servidor. Quem não está neste documento não pode ser assumido: **em caso de dúvida, pára e pergunta** (ver §9).

## 1. Quem faz o quê

| Papel | Quem | Pode | Não pode |
|---|---|---|---|
| **PO (dono)** | Pessoa | Decide negócio, autoriza, dá o «OK» final, funde Pull requests, controla acessos | — |
| **Executor** | Manus | Escrever código, testes e documentação em **ramos próprios**; abrir Pull requests; responder a revisões | Fundir, aprovar, publicar, tocar em servidores, usar dados reais, criar/guardar segredos, alterar as zonas protegidas sem aprovação prévia (§6) |
| **Revisor** | Claude (esta conversa) | Analisar cada Pull request, correr as verificações, aprovar ou recusar por escrito, manter este protocolo; **fundir uma Pull request já APROVADA, com CI verde e OK do PO, quando o PO o delegar por escrito** (feito na TAREFA-1) | Fundir sem as três condições, publicar, aceitar trabalho sem evidência |
| **Revisão final de entrega** | Claude (Revisor). Desde 2026-10-20 o Codex deixou de ser usado por decisão do PO | Revisão separada ao fecho de cada entrega, sobre uma **extracção limpa** do commit, com todas as verificações e lista adversarial (veredicto APROVADO / COM RESSALVAS / REPROVADO) | Fingir independência: o Revisor escreveu parte do código revisto e deve dizê-lo |
| **Publicador** | Outro Claude Code, com acesso ao servidor | Publicar **só** um commit aprovado, com CI verde e OK do PO | Publicar o que não tenha as três condições; alterar código; usar o pacote de outro commit |

Fusão: antes de fundir o Revisor confirma que o commit fundido tem **a mesma árvore** (`git rev-parse <commit>^{tree}`) que o aprovado; por isso usa-se «Create a merge commit», nunca rebase nem squash.

Cadeia obrigatória para qualquer alteração: **Manus produz → CI verde → Claude aprova (comentário de aprovação, §7) → PO dá OK → Publicador publica.** Nenhum elo se salta.

## 2. O que já foi feito (não refazer)

Fonte de verdade: `docs/ESTADO.md`, `docs/decisions/ADR-0001…0009`, `docs/security.md`, `docs/revisoes/`.

- **Entregas 0, A–G FECHADAS** (Codex aprovou e o PO deu OK): fundação e CI; identidade e segurança; estrutura escolar e matrículas; notas e pautas (com correcção auditada); financeiro (livro de movimentos, recibos PDF, estornos com dupla aprovação, relatórios); portais do estudante e do encarregado; pedidos e declarações em PDF.
- **PWA** (instalável no telemóvel; service worker só guarda `/offline`).
- **Entrega H** — código aprovado com ressalvas pelo Codex: H1 isolamento (três papéis de base de dados, auditoria com origem), H2 importador Excel (lote, relatório mascarado, reversão com bloqueios), H3 cópias cifradas + restauro + Docker/Compose/Caddy, D11 envio de email por SMTP, `verificar:privilegios`, `verificar-servidor.sh`.
- **Empacotamento:** fluxo GitHub «Pacote» (`.github/workflows/pacote.yml`, ainda por fundir: Pull request n.º 1) e pacotes feitos à mão. Último commit com CI verde e pacote entregue: `80fec5ecfe4245937a831b763889a38a60687d8a`.
- **Em produção/staging no servidor da escola:** a app do commit `55d555d9364c7f75d32728a40eec65fb8c42341e` (mostra ainda «Em construção»; a correcção está no `80fec5e`).
- Números de referência: 308 testes Vitest (unitários + integração com PostgreSQL 16) e 34 e2e (Playwright), todos verdes.

## 3. O que falta (e o que o Manus pode ou não fazer)

**Não é trabalho para o Manus** (depende da escola ou do PO; o Manus não toca): servidor, domínio e SMTP reais; análise dos Excel reais e reconciliação assinada; testes em Android e iPhone reais; aceitação por papéis; decisões D4 (fórmula das notas) e validação estrita das pautas; decisões provisórias P1/P3; tornar o repositório privado.

**Trabalho candidato ao Manus** — só depois de o PO o pôr por escrito como tarefa (o Manus **não inventa funcionalidades**):
1. Paginação da lista de utilizadores (pendência registada).
2. Qualquer correcção de utilização encontrada em staging (ex.: o início «Em construção», já corrigido).
3. Itens que o PO ou o Revisor abrirem como tarefa numerada (`TAREFA-<n>`), cada uma com: objectivo, critério de aceitação, ficheiros previstos, zona (verde/amarela/vermelha, §6).

Cada tarefa vive numa Pull request. O Revisor mantém a lista de tarefas abertas em `docs/ESTADO.md`.

## 4. Regras permanentes (valem para todo o trabalho)

1. **Língua:** interface e documentação em **português europeu**. Código e identificadores seguem o que já existe.
2. **Dinheiro:** só **inteiros em cêntimos** (`BigInt`); nunca `number` decimal; nunca somar/arredondar em `float`.
3. **Autorização no servidor, sempre.** Esconder um botão não é segurança. Toda a acção sensível verifica sessão e permissão no servidor e a base de dados volta a verificar onde está previsto (ADR-0004, 0008).
4. **Dados:** nunca dados reais de alunos fora da produção; só dados fictícios (prefixos `IMP-`, `exemplo.lamanu.test`). Relatórios e logs sem dados pessoais (números de processo, BI e datas de nascimento mascarados).
5. **Segredos:** nenhum no código, nos testes, nos commits, nos registos, nos comentários nem nas conversas. Variáveis de ambiente: só os **nomes** em documentos. `.env*` nunca é commitado (só `.env.example` e `.env.staging.example`, com valores fictícios).
6. **Sem push para o ramo por omissão, sem publicação, sem migrações destrutivas, sem tocar em servidores** — nunca, por nenhuma razão, sem autorização escrita do PO.
7. **Nunca afirmar que algo passa sem o ter corrido.** Cada afirmação leva o comando e o resultado. Se não correu, escreve «não corri».
8. **CI tem de passar à 1.ª tentativa.** Proibido re-lançar às cegas, saltar/desactivar/«quarentenar» testes, ou empurrar commits vazios para provocar o CI. Uma falha intermitente investiga-se até à causa (já houve uma: colisões em `Classe.ordem`).
9. **Correcções: o teste primeiro.** Reproduzir o problema com um teste que **falha**, corrigir, ver passar. Para defesas de segurança, **validar por mutação**: retirar a defesa, ver o teste falhar, repor (confirmar com `cmp`/hash) e só então avançar.
10. **Perguntas ao PO:** sempre **exactamente 3 opções**, a recomendada primeiro com o motivo numa linha, só para decisões de negócio ou autorizações (`docs/REGRAS-COMUNICACAO.md`). O que é técnico, decide-se e regista-se.
11. **Next.js 16 não é o que conhece:** antes de escrever código de rotas, `proxy.ts`, Server Actions ou cache, ler o guia certo em `node_modules/next/dist/docs/` (ver `AGENTS.md`). Prisma 7 com `@prisma/adapter-pg`: o cliente gerado fica em `src/generated/prisma` (não se commita).
12. **Migrações:** só **aditivas** e **novas** (nova pasta com data/hora em `prisma/migrations/`). **Nunca** editar uma migração já aplicada (os hashes são comparados no servidor). Qualquer `DROP`, `TRUNCATE`, alteração de tipo ou perda de dados é **zona vermelha** e precisa de autorização do PO.
13. **Arquitectura de segurança (não contornar):** três utilizadores de base de dados — dono (`lamanus`, só migrações/administração), `lamanus_app` (negócio, sem poderes de dono) e `lamanus_auth` (só `src/server/auth`). A aplicação **nunca** escreve directamente no livro financeiro, em contas/papéis/permissões nem na auditoria: usa as funções `SECURITY DEFINER` que autenticam o autor pela sessão. Qualquer código novo respeita isto e é provado por teste contra a ligação restrita.
14. **Documentar:** cada alteração relevante actualiza `docs/ESTADO.md` e, se há decisão de arquitectura, um ADR novo (`docs/decisions/ADR-00NN-….md`).

## 5. Fluxo de uma tarefa (passo a passo do Manus)

1. **Ler** `docs/ESTADO.md`, `docs/PROTOCOLO-MANUS.md`, `docs/security.md` e os ADR da área. Confirmar a zona da tarefa (§6).
2. **Ramo:** `git checkout -b manus/TAREFA-<n>-<tema>` a partir do ramo por omissão actualizado. Nunca trabalhar directamente no ramo por omissão.
3. **Ambiente local:**
   ```bash
   cp .env.example .env                 # valores FICTÍCIOS de desenvolvimento
   docker compose up -d db              # PostgreSQL 16 + papéis lamanus_app/lamanus_auth
   npm ci && npx prisma generate
   npm run db:preflight && npm run db:deploy && npm run db:seed
   ```
4. **Teste primeiro** (regra 9), depois a implementação mínima. Sem alargar o âmbito.
5. **Verificações completas, todas, antes de empurrar:**
   ```bash
   npm run lint && npm run format:check && npm run typecheck
   npm run verificar:privilegios
   npm test
   npm run test:e2e        # se mexeu em páginas/rotas (ou se não correu, dizê-lo)
   ```
   Se a tarefa toca em migrações/cópias: `bash scripts/testar-restauro.sh`.
6. **Auto-revisão adversarial:** reler o próprio diff como um atacante e como um revisor: autorização no servidor? dado pessoal em log? dinheiro em cêntimos? teste que falha sem a correcção? Corrigir antes de empurrar.
7. **Commit** pequeno e descritivo (português), sem segredos. **Push só para o seu ramo** `manus/…`.
8. **Abrir a Pull request** para o ramo por omissão com o relatório do §8. **Não fundir.**
9. **Esperar o CI.** Se falhar: diagnosticar a causa, corrigir, repetir as verificações do passo 5 e só então empurrar. Nunca re-lançar às cegas.
10. **Responder à revisão** do Claude: implementar o pedido (ou explicar por escrito porque não), re-correr o passo 5, actualizar o relatório. Repetir até «APROVADO».

## 6. Zonas e permissões

- **Verde** (Manus decide e implementa): páginas e componentes de apresentação, textos, testes novos, documentação.
- **Amarela** (precisa de nota de desenho de 10 linhas aprovada pelo Revisor **antes** de codificar): novas rotas/Server Actions, novas permissões ou papéis (`src/server/authz/*`), módulos de negócio em `src/server/modules/*` (excepto financeiro/declarações), novas migrações aditivas, importador.
- **Vermelha** (só com autorização escrita do PO **e** aprovação prévia do Revisor; nunca por iniciativa do Manus):
  `prisma/migrations/*` já existentes, `prisma/grants.sql`, `docker/db/papeis.sql`, `src/server/auth/*`, `src/server/seguranca/*`, `src/server/db*.ts`, financeiro e declarações (`src/server/modules/financeiro.ts`, `declaracoes.ts`, PDFs), `.github/workflows/*`, `Dockerfile`, `docker-compose*.yml`, `docker/caddy/*`, `docker/pacote/*`, `scripts/empacotar.mjs`, `scripts/backup.sh`/`restaurar.sh`, `next.config.ts`, `package.json`/`package-lock.json` (novas dependências exigem justificação e versão fixa).

## 7. O que o Claude (Revisor) verifica e como aprova

Para cada Pull request, **sobre o commit exacto** (hash de 40 caracteres) e não sobre a descrição:
1. Zona respeitada e âmbito = tarefa (nada a mais).
2. Diff lido na íntegra; nenhum segredo, dado pessoal, `console.log` de dados, `.env`, binário ou ficheiro gerado.
3. Verificações re-corridas por mim (lint, formato, tipos, `verificar:privilegios`, Vitest, e2e quando aplicável) e CI verde **à 1.ª tentativa** nesse commit.
4. Teste que falha sem a correcção e, em defesas de segurança, mutação demonstrada.
5. Dinheiro em cêntimos; autorização no servidor; funções de base de dados em vez de escritas directas; migrações novas e aditivas.
6. Documentação e `docs/ESTADO.md` actualizados.

**Aprovação** = um comentário na Pull request, neste formato exacto (sem ele, nada é publicável):

```
APROVADO — commit <hash de 40 caracteres>
Verificações: lint ✔ formato ✔ tipos ✔ privilégios ✔ vitest N ✔ e2e N ✔ CI <ligação>
Zona: verde|amarela|vermelha · Ressalvas: nenhuma | <lista>
Próximo passo: OK do PO → publicação
```

Ou **RECUSADO — commit <hash>** com a lista numerada do que corrigir. **A aprovação vale só para esse hash**: qualquer commit novo na Pull request anula-a e exige nova aprovação. A aprovação por Pull request não substitui a revisão final de entrega nem o OK do PO. **Nota de independência:** como o Codex deixou de ser usado, a revisão final é do próprio Claude, que escreveu grande parte do código; o PO sabe que já não é uma revisão de terceiros.

Limite honesto: o Revisor só garante o que correu e leu. Não vê o servidor, nem dados reais, nem dispositivos reais.

## 8. Relatório obrigatório em cada Pull request (modelo)

```
Tarefa: TAREFA-<n> — <título>
Commit (40 caracteres): …
Zona: verde|amarela|vermelha (aprovação prévia: <ligação>)
O que mudou: <3–6 linhas>   Ficheiros: <lista>
Teste que falha sem a correcção: <ficheiro> — corrido antes: FALHOU / depois: PASSOU
Mutação (se segurança): <defesa retirada> → <teste que falhou> → reposta (hash igual)
Verificações (comando → resultado, números reais):
  lint … · formato … · tipos … · privilégios … · vitest N passaram · e2e N passaram
  Não corri: <o quê e porquê> (ou «nada»)
CI: <ligação> — 1.ª tentativa: sim/não
Migrações: nenhuma | <nova pasta, aditiva>   Variáveis de ambiente novas: nenhuma | <só nomes>
Dados pessoais/segredos: nenhuns (confirmado por <pesquisa>)
Riscos e pendências: <lista>   Perguntas ao PO (3 opções): nenhuma | <…>
```

## 9. Quando parar e perguntar

O Manus **pára e devolve a pergunta** (ao Revisor para o que é técnico; ao PO, em 3 opções, para negócio ou autorização) quando: a tarefa toca uma zona vermelha; os requisitos se contradizem; precisa de um segredo, de dados reais ou de acesso ao servidor; um teste falha por razão que não percebe; o CI falha por causa que não é sua; detecta um possível problema de segurança em código existente (relata-o, não o «corrige» em silêncio).

## 10. Publicação (só o Publicador, só com as três condições)

1. Existe o comentário **APROVADO — commit <hash>** do Revisor sobre esse hash.
2. O CI desse commit está verde (à 1.ª tentativa).
3. O PO deu o OK por escrito para esse commit.

O Publicador **recusa** qualquer outro commit. O pacote é gerado do commit aprovado (fluxo «Pacote» com `commit` completo, ou à mão a partir de uma extracção limpa) e entregue com **nome, tamanho em bytes e SHA-256**; antes de trocar a versão, compara as migrações (hash de cada ficheiro) com as já aplicadas na base; se alguma diferir, pára. Troca por pasta nova com marcha-atrás à anterior, verifica `/login` 200, `/estudante` e `/interno` 307 e o registo sem erros; se algo falhar, volta atrás. A base de dados só é tocada por migrações aditivas aprovadas. O Manus **nunca** executa nada disto.

## 11. Acesso do Manus ao GitHub (decisão e acção do PO)

O Revisor **não** pode conceder acessos nem criar tokens; é o dono do repositório que decide. Princípio: **mínimo privilégio**.
- **Opção recomendada — fork + Pull request:** enquanto o repositório for público o Manus não precisa de acesso nenhum ao repositório: trabalha num *fork* e abre Pull requests. Quando o repositório passar a privado, passar à opção seguinte.
- **Colaborador com escrita limitada:** convidar a conta do Manus (*Settings → Collaborators*) com papel **Write** (nunca Admin) e activar **protecção do ramo por omissão** (*Settings → Branches*): exigir Pull request, exigir CI verde, exigir aprovação do dono, impedir *force-push* e remoção, e restringir quem pode empurrar. O Manus empurra só para ramos `manus/*`.
- **Token fino (alternativa):** *Fine-grained token*, só este repositório, **Contents: Read and write** e **Pull requests: Read and write**; **sem** *Workflows*, **sem** *Administration*, **sem** *Secrets*; validade curta (30 dias). Guardar o token só no cofre do Manus; **nunca o enviar por chat**.
Em qualquer opção: o Manus não recebe segredos de produção, `DATABASE_URL` reais, chaves de SMTP nem acesso ao servidor.

## 12. Se alguma regra falhar

Uma regra violada (segredo exposto, dado real em teste, push indevido) é **incidente**: parar, avisar o PO e o Revisor de imediato, não apagar rasto (git/registos), e seguir `docs/runbook-incidentes.md`. Um segredo exposto considera-se comprometido: revoga-se e substitui-se.
