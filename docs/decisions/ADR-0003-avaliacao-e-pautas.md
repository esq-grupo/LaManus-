# ADR-0003 — Avaliação, notas e pautas

- **Data:** 2026-10-16
- **Estado:** Provisória (D4 e decisão 6 por confirmar com a escola; decisão 7 aprovada pelo PO)
- **Responsável:** Claude Code (construtor); aprovação: Escola / E-ESQ

## Contexto
O erro mais grave possível nesta entrega é **um estudante ou encarregado ver uma nota que ainda não foi publicada**, ou uma nota mudar depois de validada sem rasto. Aplicam-se as lições das entregas anteriores: regras críticas na base de dados, alteração e auditoria na mesma transacção, testes de concorrência e validação dos testes por mutação.

## Decisões
1. **Notas em centésimas e médias em décimas (inteiros).** 14,5 → `1450`; média 14,3 → `143`. Nunca se calcula com vírgula flutuante. `CHECK` na BD: nota de 0 a 2000, peso de 1 a 100.
2. **Fórmula (D4 provisória):** escala 0–20; média ponderada pelos pesos das avaliações **que têm nota**; 1 casa decimal; arredondamento «meio para cima» (14,25 → 14,3). A média geral do período é a média simples das médias das disciplinas. Os parâmetros estão num único sítio (`src/lib/avaliacao.ts`, `CONFIG_AVALIACAO`).
3. **Coerência garantida pela BD:** chaves compostas fazem com que a disciplina seja da turma e o período do mesmo ano lectivo da turma (`Avaliacao`, `PautaPublicacao`).
4. **Só o docente da disciplina lança** (decidido a partir da sessão → `TurmaDisciplina.docente.userId`). A Direcção, a Secretaria e a Qualidade só vêem. Qualquer tentativa de outro utilizador é recusada **e auditada**.
5. **Pauta (turma × período) com estados RASCUNHO → VALIDADA → PUBLICADA** (e VALIDADA → RASCUNHO, «reabrir», com motivo). **PUBLICADA é definitiva** (gatilho da BD). Só a Direcção valida, publica e reabre (`pauta:publicar`).
6. **Validar exige todas as notas lançadas** (todas as avaliações × todos os estudantes com matrícula activa) e pelo menos uma avaliação. *É a regra mais rígida; pode ter de ser flexibilizada (ex.: faltas justificadas) — a confirmar com a escola.*
7. **Correcção depois de publicada:** só a Direcção (nova permissão `notas:corrigir`), nota a nota, com motivo obrigatório e auditoria antes/depois. É feita pela função privilegiada `corrigir_nota_publicada` da base de dados (ver decisão 12); o docente que lançou a nota **não** corrige depois de publicada. **Decisão do PO (2026-10-16): só a Direcção corrige, com motivo.** O docente pede a correcção à Direcção.
8. **Bloqueio na BD** (gatilhos): com a pauta VALIDADA ou PUBLICADA, nenhuma nota ou avaliação pode ser inserida, alterada ou apagada pelo papel da aplicação, **seja qual for o caminho**, excepto pela função de correcção. Os gatilhos verificam a pauta **antiga e a nova** e tornam imutáveis as chaves (nota: avaliação e estudante; avaliação: disciplina, turma, período e ano; pauta: turma, período e ano). Uma pauta só **nasce em RASCUNHO**, PUBLICADA é totalmente imutável, transições inválidas e apagar pautas são rejeitadas, e `TRUNCATE` é travado.
9. **Concorrência:** validar/publicar/reabrir bloqueiam a linha da pauta (`FOR UPDATE`); lançar notas bloqueia-a em modo partilhado (`FOR SHARE`). Assim «validar» e «lançar» nunca se cruzam: o que foi validado é exactamente o que está gravado.
10. **Leitura por papel numa só consulta SQL** (`notas-leitura.ts`): para estudantes e encarregados o filtro «pauta PUBLICADA» faz parte da própria consulta — uma nota por publicar **nem sai da base de dados**. Direcção/Secretaria/Qualidade vêem tudo com o estado; o Docente vê só as suas disciplinas; Financeiro, RH e Admin técnico não vêem notas. Os portais nunca recebem o estado da pauta.
11. **Alteração + auditoria na mesma transacção** (`comAuditoria`) em todas as operações desta entrega.

12. **Separação de papéis na base de dados (revisão n.º 1 do Codex).** O interruptor anterior era uma variável de sessão (`app.permitir_correcao`) que **qualquer ligação** podia definir. Foi eliminado. Agora: (a) o **dono das tabelas** (`lamanus`: migrações, seed, administração) é de confiança e é o único que os gatilhos deixam contornar — a decisão é pela **identidade** (`current_user`), não por uma variável; (b) a **aplicação corre com o papel restrito `lamanus_app`** (`docker/db/papeis.sql`, `prisma/grants.sql`): lê e escreve dados mas não é dona, por isso não pode desligar gatilhos, apagar índices, fazer `TRUNCATE`, mudar o dono nem assumir outro papel; (c) a correcção de notas publicadas é a função `corrigir_nota_publicada` (`SECURITY DEFINER`), que valida (pauta publicada, valor 0–20, motivo ≥ 5 caracteres, valor diferente) e grava a auditoria na mesma transacção. A aplicação tem `ADMIN_DATABASE_URL` (só migrações/seed/testes) e `DATABASE_URL` (restrita); `src/` nunca usa a de administração.

## Alternativas rejeitadas
| Alternativa | Motivo |
|---|---|
| Notas em `Decimal`/`float` | Erros de arredondamento; inteiros são exactos e testáveis |
| Filtrar «publicadas» no JavaScript depois de ler | A nota já saiu da BD; um erro futuro podia expô-la |
| Bloquear alterações só no código | Qualquer outro caminho (script, importação) contornava a regra |
| Docente corrige depois de publicada (com motivo) | Troca de responsabilidade; a Direcção é quem publica e responde pela pauta |
| Interruptor por variável de sessão | Qualquer ligação podia activá-lo (achado do Codex) |
| Aplicação a correr como dono das tabelas | Um erro de SQL na aplicação podia desligar as protecções |
| Reabrir pautas publicadas | Os portais já mostraram as notas; a correcção nota a nota deixa rasto claro |

## Impacto
Migrações `20261016100000_avaliacao` (tabelas novas, sem dados existentes: não precisa de pré-verificação) e `20261016200000_blindar_pautas` (funções e gatilhos). Nova permissão `notas:corrigir` (Direcção). **Operação:** em staging/produção a aplicação tem de usar o papel `lamanus_app` (ver `docs/migracoes.md`); se correr como dono, as protecções por SQL directo deixam de valer.
