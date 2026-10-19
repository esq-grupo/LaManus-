# ESTADO — Projecto Lá Manu (EESQ-LM-001)

Actualizado: 2026-10-17

> Regra permanente: perguntas ao PO = 3 opções, recomendada primeiro (`docs/REGRAS-COMUNICACAO.md`).

## Posição actual
- **Entrega 0:** FECHADA (Codex APROVADO COM RESSALVAS na revisão 2, ressalvas corrigidas; OK do PO em 2026-10-13).
- **Entrega A:** FECHADA (Codex APROVADO na revisão 3 + OK do PO em 2026-10-13).
- **Entrega B:** FECHADA (Codex APROVADO na revisão 2 + OK do PO em 2026-10-13).
- **Entrega C:** FECHADA (Codex APROVADO COM RESSALVA OPERACIONAL — tratada com `db:preflight` — + OK do PO em 2026-10-16).
- **Entrega D:** FECHADA (Codex APROVADO COM RESSALVAS na revisão 3 + OK do PO em 2026-10-17).
- **Entrega E:** FECHADA (Codex APROVADO na revisão n.º 3 + OK do PO em 2026-10-17).
- **Entrega actual:** F — Portais (implementada; a aguardar CI, Codex e OK do PO).
- **Depois:** F — Portais (só após Codex APROVADO + OK PO na E).
- Decisões D1–D14 e P3 (cêntimos `BigInt`) em uso como provisórias (modo autorizar).

## Tarefas da Entrega F
- [x] Portais mobile-first (estudante e encarregado): notas publicadas, contas, recibos PDF
- [x] Selector de educando; endereço por educando; acesso cruzado → 404
- [x] Avisos (pauta publicada, nota corrigida, recibo emitido) com contador de não lidos
- [x] Testes: 50 unitários, 187 integração, 27 e2e; Lighthouse móvel 0,97–0,99 / acessibilidade 1,00
- [x] CI verde à 1.ª tentativa (execução 39253442277)
- [x] Codex: APROVADO COM RESSALVAS (escopo por vista em notasDoEstudante) — corrigido
- [ ] CI da correcção e OK do PO

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
