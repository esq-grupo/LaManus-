# ESTADO — Projecto Lá Manu (EESQ-LM-001)

Actualizado: 2026-10-17

> Regra permanente: perguntas ao PO = 3 opções, recomendada primeiro (`docs/REGRAS-COMUNICACAO.md`).

## Modelo de trabalho (desde 2026-10-20)
Manus produz (ramos `manus/*`, só Pull requests), Claude revê e aprova por escrito (comentário «APROVADO — commit <hash>»), o PO dá o OK e outro Claude Code publica. Ver `docs/PROTOCOLO-MANUS.md`.

## Incidente de CI (2026-10-22)
O ensaio de restauro passou a falhar no CI (`pg_restore: unrecognized configuration parameter "transaction_timeout"`) porque o `pg_dump` por omissão do corredor do GitHub é mais novo que o PostgreSQL 16 do serviço. Correcção: `scripts/pg-cliente.sh` (usa o cliente do mesmo major do servidor e **recusa** um mais novo), usado por `backup.sh` e `restaurar.sh`; o CI instala o `postgresql-client-16`. Vale também para o servidor da escola: o `pg_dump` tem de ser do major do servidor.

## Segurança de dependências (2026-10-22)
`npm audit` marcou o Next.js 16.4.0 como **crítico** (execução remota de código na optimização de imagens com SVG e em funções `use cache`; negação de serviço nas Server Actions). Actualizado para **16.4.2** (e `eslint-config-next`); `npm audit --omit=dev` já não lista o Next. Ficam avisos em ferramentas que não correm no servidor da app: `prisma` CLI (`deepmerge-ts`, `mysql2`) e `uuid` dentro de `exceljs` (só o importador por linha de comandos). Reavaliar quando houver versões corrigidas.

## Tarefas abertas (Manus)
- **TAREFA-1** — paginação da lista de utilizadores (`docs/tarefas/TAREFA-1.md`). **FECHADA**: aprovada (commit 5ec781e263b62bec65caf153c845af3ad059f461), fundida pelo Revisor por delegação do PO no commit d7cffa50461650c2b49a8236ed879904fec7839f (árvore idêntica à aprovada; CI verde, execução 39513974309). Revisão do Codex dispensada; o Codex deixa de ser usado (decisão do PO, 2026-10-20). Falta publicar (pacote `lamanus-d7cffa504616-linux-x64.tar.gz`).

- **TAREFA-2** — aviso de lint e estado vazio dos selectores (`docs/tarefas/TAREFA-2.md`). Estado: implementação concluída no ramo `manus/TAREFA-2-limpeza-lint-estado-vazio`, a aguardar Pull request e revisão (zona verde).

- **TAREFA-3** — página de auditoria só de leitura (`docs/tarefas/TAREFA-3.md`). Estado: escrita; a aguardar nota de desenho do Manus (zona amarela).
- Perguntas à escola sobre âmbito do piloto: `docs/perguntas-escola.md`.

- **TAREFA-4** — duas propostas de desenho «premium» (maquetas HTML, `docs/tarefas/TAREFA-4.md`). Estado: **fechada**, fundida (aprovado d90456ea65ea756d826ea86a8bb3d99a0626608a). À espera da escolha A/B do cliente.
- **TAREFA-5** — correcções do PR n.º 4 (Parte A, **fechada**) + base do sistema de desenho independente de A/B (Parte B) (`docs/tarefas/TAREFA-5.md`). Estado: nota de desenho da Parte B **aprovada** (2 condições: tokens semânticos com a paleta actual por omissão; sem activos externos); a aguardar o PR do Manus.
- Plano de desenho, página pública e dados do cliente (enfermagem): `docs/PLANO-DESENHO-E-DADOS.md`.

## Posição actual
- **Entrega 0:** FECHADA (Codex APROVADO COM RESSALVAS na revisão 2, ressalvas corrigidas; OK do PO em 2026-10-13).
- **Entrega A:** FECHADA (Codex APROVADO na revisão 3 + OK do PO em 2026-10-13).
- **Entrega B:** FECHADA (Codex APROVADO na revisão 2 + OK do PO em 2026-10-13).
- **Entrega C:** FECHADA (Codex APROVADO COM RESSALVA OPERACIONAL — tratada com `db:preflight` — + OK do PO em 2026-10-16).
- **Entrega D:** FECHADA (Codex APROVADO COM RESSALVAS na revisão 3 + OK do PO em 2026-10-17).
- **Entrega E:** FECHADA (Codex APROVADO na revisão n.º 3 + OK do PO em 2026-10-17).
- **Entrega F:** FECHADA (Codex APROVADO COM RESSALVAS, corrigida + OK do PO em 2026-10-19).
- **Entrega G:** FECHADA (Codex APROVADO na revisão n.º 2 + OK do PO em 2026-10-19).
- **Entrega actual:** H — Migração e piloto (em curso; H1 feita).
- **Depois:** F — Portais (só após Codex APROVADO + OK PO na E).
- Decisões D1–D14 e P3 (cêntimos `BigInt`) em uso como provisórias (modo autorizar).

## Entrega H — em curso (OK do PO em 2026-10-19: Entrega G FECHADA)
- [x] H1 — Isolamento de sessões, papéis e auditoria (ADR-0008): papel `lamanus_auth`, funções de contas, auditoria com origem; testes de ataque. CI verde à 1.ª tentativa (execução 39291090288, commit e64be6e); revisão Codex pendente
- [x] H2 — Importador Excel (motor testado com ficheiros FICTÍCIOS; relatório de importadas/rejeitadas/transformadas; reconciliação; reversão). Decisão do PO: importar as válidas e rejeitar as erradas. **Falta analisar os ficheiros reais da escola (ambiente seguro + autorização do PO).** CI verde à 1.ª tentativa (execução 39294358618, commit 7a62515).
- [x] H3 — Backup cifrado + ensaio de restauro (corre no CI), Dockerfile + `docker-compose.staging.yml` + Caddy (TLS), primeira conta (`admin:inicial`), sincronização de permissões no deploy, `docs/deployment.md`, `docs/runbook-incidentes.md`, `docs/go-live.md`. Decisão do PO: cópia diária, guardar as últimas 14. **Falta instalar no servidor da escola (domínio, SMTP) e repetir o ensaio de restauro lá.** CI verde à 1.ª tentativa, incluindo o ensaio de restauro e a construção da imagem Docker (execução 39296341296, commit 64f1900).
- Respostas ao Codex (APROVADO COM RESSALVAS H1/H2; REPROVADO H3), corrigidas localmente e a aguardar nova revisão:
  - H1: `npm run verificar:privilegios` (catálogo + tentativas recusadas das ligações reais) — corre no CI e **tem de correr no servidor da escola** depois de cada `db:deploy`.
  - H2: relatório sem nº de processo e sem data de nascimento completa; `reverterLote` recusa (sem apagar nada) se houver actividade posterior ao lote. **Continua por validar com ficheiros reais e reconciliação assinada pela escola.**
  - H2 (revisão 2, concorrência): `reverterLote` bloqueia (`FOR UPDATE`) o lote, os estudantes, os encarregados e as ligações do lote (revisão 3: verificação concorrente pela Secretaria) antes de verificar; alterações, pagamentos/matrículas (chave estrangeira) e reversões simultâneas esperam. Teste concorrente + mutação detectada.
  - H3: o contentor `app` deixou de receber credenciais de administração (só `lamanus_app` e `lamanus_auth`); `.env.staging.example` passou a ser versionado (o `.gitignore` ignorava-o); teste `staging.test.ts` impede regressões.
- [x] D11 — envio por SMTP genérico (nodemailer; STARTTLS/TLS obrigatório em produção; erro genérico sem credenciais; `SMTP_*`). Decisão do PO: SMTP genérico configurável. Testado com servidor falso no CI; **falta validar com o serviço real da escola**
- [x] Preparação do servidor: `scripts/verificar-servidor.sh` (pré-verificação, testada), `docs/guia-tecnico-servidor.md`, `docs/revisoes/PEDIDO-REVISAO-ENTREGA-H.md`. **A aguardar o técnico do servidor da escola.**
- [ ] H4 (dossiê para a escola em docs/dossie-validacao-escola.md) — Testes de aceitação com a escola, checklist de go-live, Lighthouse/carga em staging

## PWA (pedido do PO, 2026-10-19)
- [x] Manifesto, ícones, service worker mínimo (só `/offline`), convite de instalação, entrada directa na área
- [x] Testes: 262 vitest (inclui `pwa.test.ts`), 32 e2e (inclui `pwa.spec.ts`); em produção o service worker regista-se e a cache só tem `/offline`
- [x] CI verde à 1.ª tentativa (execução 39287331279, commit f3e0c41)
- [ ] Revisão Codex (revisão separada, pedida pelo Codex)

## Tarefas da Entrega G
- [x] Pedidos de declaração (matrícula, frequência, situação financeira) pelo portal e na secretaria
- [x] Aprovação (Direcção) e emissão (Secretaria) com controlo duplo; instantâneo imutável; numeração sem saltos
- [x] PDF e descarga protegida (404 igual); avisos; auditoria
- [x] Testes: 50 unitários, 207 integração, 28 e2e
- [x] CI verde à 1.ª tentativa (execução 39258297356)
- [x] Codex: APROVADO COM RESSALVAS (2 corridas) — corrigidas (migração 20261019110000, emissão numa só transacção)
- [x] CI da correcção verde à 1.ª tentativa (execução 39285221570)
- [x] Codex: APROVADO (revisão n.º 2, commit 7ddbbc5)
- [x] OK do PO (2026-10-19): Entrega G FECHADA

## Tarefas da Entrega F
- [x] Portais mobile-first (estudante e encarregado): notas publicadas, contas, recibos PDF
- [x] Selector de educando; endereço por educando; acesso cruzado → 404
- [x] Avisos (pauta publicada, nota corrigida, recibo emitido) com contador de não lidos
- [x] Testes: 50 unitários, 187 integração, 27 e2e; Lighthouse móvel 0,97–0,99 / acessibilidade 1,00
- [x] CI verde à 1.ª tentativa (execução 39253442277)
- [x] Codex: APROVADO COM RESSALVAS (escopo por vista em notasDoEstudante) — corrigido
- [x] CI da correcção verde à 1.ª tentativa (execução 39255337747)
- [x] OK do PO (2026-10-19, «vamos avançar»): Entrega F FECHADA

## Tarefas da Entrega E
- [x] Tipos de encargo; geração mensal em lote idempotente; encargo avulso; anulação com motivo
- [x] Pagamento em 2 passos (registar → Direcção confirma) com alocação automática ao encargo mais antigo (ou manual)
- [x] Recibo com numeração sem saltos + PDF (verifica permissão e escopo em cada descarga)
- [x] Estorno com proposta (Financeiro) e aprovação (Direcção, outra pessoa); movimento inverso
- [x] Saldo calculado; relatórios (dívidas por turma, recebimentos por período, extracto) e reconciliação
- [x] Livro imutável na BD (grants + gatilhos + funções autenticadas pela sessão)
- [x] Testes: 48 unitários, 178 integração, 24 e2e (ver relatório)
- [x] CI verde (execução 39067579076)
- [x] Codex: APROVADO COM RESSALVAS (ordem do estorno parcial) — corrigido na migração 20261017120000
- [x] Revisão n.º 2 do Codex (falso positivo de teste) corrigida; CI verde à 1.ª tentativa (execução 39071990746)
- [x] Codex: APROVADO (revisão n.º 3, commit 2a3f5fa)
- [x] OK do PO (2026-10-17): Entrega E FECHADA

## Tarefas da Entrega D
- [x] Avaliações com pesos; lançamento de notas só pelo docente da disciplina
- [x] Médias (fórmula D4 provisória: ponderada, 1 casa, meio para cima), em inteiros
- [x] Pautas: validar → publicar (e reabrir); correcção após publicação com motivo (Direcção)
- [x] Portais: só notas publicadas (filtro na consulta SQL)
- [x] Testes: 41 unitários, 136 integração, 23 e2e

## Tarefas da Entrega C (fechada)
- [x] Anos lectivos, períodos, classes, turmas, disciplinas, funcionários, atribuição de docentes
- [x] Estudantes e encarregados (pesquisa por nome, n.º de processo e BI)
- [x] Ligação estudante–encarregado com verificação e revogação
- [x] Matrículas (nova/renovação), transferência de turma auditada, anulação
- [x] Escopo real: estudante, encarregado, docente
- [x] Testes: 31 unitários, 79 integração, 17 e2e

## Tarefas da Entrega B (fechada)
- [x] Modelo User/Role/Permission/Session/PasswordReset/EventoAuditoria + migração (trigger imutável)
- [x] Login/logout, bloqueio (conta e IP), política de passwords, recuperação
- [x] Camada `authz` (can, áreas, escopo, separação de funções)
- [x] Protecção por área (DAL + proxy optimista)
- [x] Gestão de utilizadores (Admin técnico)
- [x] Auditoria de login, papéis e acessos negados
- [x] Testes: 29 unitários, 29 integração, 8 e2e

## Tarefas da Entrega A (fechada)
- [x] Scaffold Next.js 16 + TypeScript strict
- [x] Tailwind CSS 4
- [x] Prisma 7 + PostgreSQL 16 (`docker-compose.yml`), migração inicial
- [x] `.env.example` (sem segredos reais)
- [x] Scripts `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`
- [x] GitHub Actions (`.github/workflows/ci.yml`): jobs `verificar` e `compose` verdes (execução 38463072539)
- [x] Layout com 3 áreas (interno, estudante, encarregado) + login vazio
- [x] Seed fictício idempotente
- [x] `README.md`

## Pendências registadas
- P1 (guardar CLAUDE.md/AGENTS.md no repo), P3 (unidade monetária) — aguardam PO/escola.
- Verificar renderização do Mermaid no GitHub.
- Atribuir nomes aos responsáveis dos riscos.
- Teste de carga do servidor (ADR-0001) — Entrega F.
- Docker não disponível no ambiente do construtor; o `docker compose` é validado pelo job `compose` do CI.
- Avisos das Actions: Node 20 deprecated em `actions/checkout@v4`/`setup-node@v4` e `eslint@9` sem suporte futuro — tratar antes de Setembro/2027 (baixo).
- Next.js gera um `AGENTS.md` ao instalar; foi removido e ignorado para não colidir com o manual do Codex.
- Limitações da Entrega B: ver `docs/security.md` §7.
- Limpeza agendada de sessões/tentativas/resets — por implementar.
- Recomendações do Codex (Entrega B): limite por IP de melhor esforço; bloqueio por conta como vector de abuso; configurar SMTP antes da produção.
- Entrega C: D9 decidida pelo PO em 2026-10-14 — só o Admin técnico cria contas (ADR-0002); a confirmar com a escola. Verificação documental da ligação sem anexo (Entrega G).
- Antes de migrar bases com dados: `npm run db:preflight` (docs/migracoes.md).
- Entrega D: fórmula (D4) e validação estrita provisórias; quem corrige notas publicadas: decidido pelo PO em 2026-10-16 (só a Direcção, com motivo) — ADR-0003; a confirmar com a escola.
- **Intermitente por investigar:** `avaliacao.test.ts › OUTRO docente não cria avaliações…` falhou 1 vez numa suite completa; não reproduzido em mais de 8 execuções.
- **Operação (obrigatório antes do piloto):** a aplicação tem de correr com o papel `lamanus_app` (`docs/migracoes.md`); com o dono, as protecções por SQL directo não valem.
- Lista de utilizadores limitada a 50 com pesquisa; falta paginação completa (Entrega F/H).
- `prisma migrate reset` exige consentimento explícito do PO (protecção do Prisma); não usado.
- **Decisão do PO (2026-10-16):** a configuração dos dois papéis da base de dados no servidor da escola fica para o plano de deploy (Entrega H); o procedimento já está em `docs/migracoes.md`. Pendente para a Entrega H: criar `lamanus_app`, configurar `ADMIN_DATABASE_URL`/`DATABASE_URL` e correr a verificação rápida.
- **ENTREGA H — SEGURANÇA OBRIGATÓRIA (exigência do Codex, revisão 3 da Entrega D):** isolar em funções próprias a criação/revogação de sessões, a atribuição de papéis e o registo de auditoria (retirando ao papel `lamanus_app` a escrita directa nessas tabelas); garantir a integridade da auditoria de forma independente (cadeia de hashes ou cópia externa só de acréscimo); decidir onde se verifica a palavra-passe. Até estar feito, **não alegar** protecção contra o comprometimento do papel da aplicação (ADR-0003, decisão 13; `docs/security.md` §9.2).
- Operação: não activar o registo de parâmetros de consultas no PostgreSQL de produção (o token de sessão é passado como parâmetro).
- Testes intermitentes (`avaliacao`/`pautas`): causa provável encontrada e corrigida em 2026-10-17 — colisões aleatórias de `Classe.ordem` nos testes (0 falhas em 16 execuções completas; CI verde à 1.ª tentativa). Se voltarem, reabrir.
