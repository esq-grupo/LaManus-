# ADR-0002 — Estrutura escolar, ligação encarregado–estudante e matrículas

- **Data:** 2026-10-13
- **Estado:** Provisória (a confirmar com a escola: D3, D8, D9)
- **Responsável:** Claude Code (construtor); aprovação: E-ESQ / Escola

## Contexto
A Entrega C introduz as entidades de que dependem notas, finanças e portais. O erro mais caro aqui é um encarregado ver o educando errado, ou um estudante ficar com duas matrículas activas. Por isso as regras críticas estão **na base de dados** e não só no código.

## Decisões
1. **Uma matrícula activa por estudante e ano lectivo** — índice único parcial (`WHERE estado = 'ACTIVA'`). Vale mesmo com pedidos simultâneos (testado com 10 pedidos em paralelo → 1 criado).
2. **A turma tem de ser do ano da matrícula** — chave estrangeira composta `(turmaId, anoLectivoId) → Turma(id, anoLectivoId)`. A BD recusa incoerências.
3. **Um só ano lectivo ACTIVO** — índice único parcial. Estados: PLANEADO → ACTIVO → FECHADO (irreversível). Ano FECHADO não aceita turmas, períodos nem matrículas.
4. **NOVA vs RENOVAÇÃO validadas**: «Nova» só sem historial (ignorando matrículas anuladas); «Renovação» só com historial. Evita erros de classificação nos relatórios.
5. **Transferência de turma** só dentro do mesmo ano, com motivo obrigatório; fecha a matrícula como TRANSFERIDA e abre outra (historial preservado), numa transacção, com auditoria antes/depois.
6. **Ligação encarregado–estudante**: nasce `verificado = false`, `autorizacaoActiva = true`. O encarregado só vê o educando com **ambos** verdadeiros, dentro da validade e com a ficha de Encarregado não arquivada. Um encarregado pode ter vários educandos (D8) e é reutilizado pelo BI. Um só «principal» por estudante (índice parcial).
7. **Escopo de leitura de estudantes** (`escopoEstudantes`): gestão vê todos; Estudante só o próprio; Encarregado só ligações verificadas e activas; Docente só alunos com matrícula ACTIVA em turmas onde lecciona; os restantes, nada. Acesso a um ID fora do escopo devolve `null` → 404 (não revela se existe).
8. **BI** mascarado para quem não pode editar estudantes e **nunca completo na auditoria**.
9. **N.º de processo introduzido pela Secretaria** (não gerado): respeita a numeração actual da escola e a migração do Excel (Entrega H).
10. **Docente de uma disciplina** tem de ser um Funcionário com conta de papel Docente.

## Correcções da revisão n.º 1 do Codex (2026-10-15)
11. **Estrutura escolar com escopo**: o Docente só vê as turmas onde lecciona e **só as suas atribuições** (não vê outros docentes, outras turmas nem a lista de funcionários); só quem edita a estrutura recebe a lista de funcionários. Gestão (Direcção, Secretaria, Financeiro, Qualidade, Admin técnico) vê tudo; quem acumula papéis fica com a união.
12. **Matrícula inicial («Nova») única por estudante** garantida pela BD (índice parcial sobre `tipo = 'NOVA'` e estado ACTIVA/CONCLUIDA). A verificação no código tinha uma janela de corrida entre anos diferentes. A transferência não conflita (a matrícula transferida deixa de contar e a sucessora herda o tipo); uma «Nova» anulada permite recomeçar.
13. **Datas em `Africa/Luanda`**: a validade da ligação encarregado–estudante e a «data de nascimento futura» usam o dia da escola (`hojeEmLuanda`), nunca o fuso do servidor. Testado com horas de fronteira e com `TZ` extremos.
14. **Alteração + auditoria na mesma transacção** em todos os serviços da Entrega C (`comAuditoria`): se a auditoria falhar, a alteração não fica gravada. Testado com falha simulada da auditoria.

## Divergência a decidir pelo PO (D9)
O guião (D9, provisória) diz «contas de estudante criadas pela Secretaria». Na Entrega B ficou que **só o Administrador técnico cria contas** (princípio do menor privilégio). Na Entrega C a Secretaria **associa** contas já existentes ao estudante/encarregado, mas não as cria. **Decisão do PO (2026-10-14): manter — só o Administrador técnico cria contas**; a Secretaria pede a conta e associa-a depois. Estado de D9: aprovada pelo PO (E-ESQ); a confirmar com a escola.

## Alternativas rejeitadas
| Alternativa | Motivo |
|---|---|
| Validar unicidade só no código | Falha com pedidos simultâneos |
| Editar a matrícula ao transferir | Perde historial e auditoria fica pobre |
| Gerar o n.º de processo automaticamente | Conflita com a numeração existente |
| Encarregado vê o educando logo após a ligação | Risco de acesso indevido antes da verificação documental |

## Nota técnica (migrações)
Os índices parciais e `CHECK` foram escritos em SQL na migração `20261013220000_estrutura_escolar` (o Prisma não os modela). **Ao gerar migrações futuras com `prisma migrate diff` contra a BD viva, rever sempre que estes índices não são removidos.**
