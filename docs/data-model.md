# Modelo de dados — Lá Manu (versão Entrega 0, a refinar na Entrega A)

Convenções: `id` UUID · `createdAt`, `updatedAt`, `createdById` · dinheiro em `BigInt` (cêntimos de Kz; 1 Kz = 100 cêntimos; ver §2.1) · `archivedAt` (soft delete) nas entidades académicas · **movimentos financeiros nunca se apagam nem editam**.

## 1. Diagrama ER

```mermaid
erDiagram
  User ||--o{ UserRole : tem
  Role ||--o{ UserRole : atribui
  Role ||--o{ RolePermission : concede
  Permission ||--o{ RolePermission : concede
  User ||--o{ Session : abre
  User ||--o{ PasswordReset : pede
  User |o--o| Funcionario : "pode ser"
  User |o--o| Estudante : "conta de"
  User |o--o| Encarregado : "conta de"

  AnoLectivo ||--o{ Periodo : divide
  Nivel ||--o{ Classe : agrupa
  Classe ||--o{ Turma : tem
  AnoLectivo ||--o{ Turma : contem
  Funcionario |o--o{ Turma : "director de"
  Turma ||--o{ TurmaDisciplina : lecciona
  Disciplina ||--o{ TurmaDisciplina : em
  Funcionario |o--o{ TurmaDisciplina : "docente de"

  Estudante ||--o{ Matricula : tem
  Turma ||--o{ Matricula : recebe
  AnoLectivo ||--o{ Matricula : em
  Estudante ||--o{ EstudanteEncarregado : ligado
  Encarregado ||--o{ EstudanteEncarregado : ligado

  TurmaDisciplina ||--o{ Avaliacao : tem
  Periodo ||--o{ Avaliacao : em
  Avaliacao ||--o{ Nota : tem
  Estudante ||--o{ Nota : recebe
  Turma ||--o{ PautaPublicacao : tem
  Periodo ||--o{ PautaPublicacao : em

  TipoEncargo ||--o{ Encargo : define
  Estudante ||--o{ Encargo : deve
  Estudante ||--o{ Pagamento : paga
  Pagamento ||--o{ AlocacaoPagamento : distribui
  Encargo ||--o{ AlocacaoPagamento : recebe
  Pagamento ||--o| Recibo : gera
  Pagamento ||--o{ Estorno : "pode ter"
  Estorno ||--o{ EstornoAlocacao : reverte
  AlocacaoPagamento ||--o{ EstornoAlocacao : "revertida por"

  Estudante ||--o{ PedidoDeclaracao : "pedido para"
  PedidoDeclaracao |o--o| Documento : emite
  User ||--o{ Notificacao : recebe
  User ||--o{ EventoAuditoria : "actor de"
  LoteMigracao ||--o{ ErroMigracao : regista
```

## 2. Entidades e campos principais

### Identidade e acesso
- **User**: email/username único, passwordHash (argon2id), estado (ACTIVO/BLOQUEADO/DESACTIVADO), tentativasFalhadas, bloqueadoAte, ultimoLogin, mfaActivo (opcional).
- **Role**: código (DIRECCAO, SECRETARIA, FINANCEIRO, DOCENTE, RH, QUALIDADE, ESTUDANTE, ENCARREGADO, ADMIN_TECNICO). **Permission**: código `recurso:acção`. **RolePermission**, **UserRole** (N:N).
- **Session**: tokenHash, expiraEm, ultimaActividade, ip, userAgent, revogadaEm.
- **PasswordReset**: tokenHash, expiraEm, usadoEm.

### Estrutura escolar
- **AnoLectivo** (nome, início, fim, estado PLANEADO/ACTIVO/FECHADO; **só um ACTIVO**: UNIQUE parcial).
- **Periodo** (anoLectivo, ordem, nome, início, fim; UNIQUE(ano, ordem)).
- **Nivel/Ciclo**, **Classe** (nome, ordem), **Turma** (classe, ano, turno, sala, directorTurma; UNIQUE(ano, classe, nome)).
- **Disciplina**, **TurmaDisciplina** (turma, disciplina, docente; UNIQUE(turma, disciplina)).
- **Funcionario** (user opcional, cargo; RH completo em fase posterior).

### Pessoas e matrículas
- **Estudante** (numeroProcesso UNIQUE, nome, dataNascimento, BI/cédula, contactos, estado).
- **Encarregado** (nome, BI, contactos, user opcional).
- **EstudanteEncarregado** (parentesco, verificado, autorizacaoActiva, principal, validoDe/Até; UNIQUE(estudante, encarregado)).
- **Matricula** (estudante, turma, anoLectivo, tipo NOVA/RENOVACAO, estado, data). UNIQUE parcial `(estudanteId, anoLectivoId) WHERE estado = 'ACTIVA'`. Turma e ano da matrícula têm de coincidir (verificação em transacção).

### Avaliação
- **Avaliacao** (turmaDisciplina, periodo, tipo, peso, data).
- **Nota** (avaliacao, estudante, valor, lancadaPor; UNIQUE(avaliacao, estudante); CHECK 0 ≤ valor ≤ 20 [D4]).
- **PautaPublicacao** (turma, periodo, estado RASCUNHO/VALIDADA/PUBLICADA, validadaPor, publicadaEm; UNIQUE(turma, periodo)). Portais só leem notas de pautas PUBLICADA. Edição pós-publicação exige motivo e gera `EventoAuditoria`.

### Financeiro (livro imutável)
- **TipoEncargo** (nome, valorReferencia, periodicidade).
- **Encargo** (estudante, tipoEncargo, periodoRef, valor ≥ 0, vencimento). Estado (PENDENTE/PARCIAL/PAGO/VENCIDO) **calculado**, não guardado.
- **Pagamento** (estudante, pagoPor opcional, valor > 0, método, referenciaExterna, data, registadoPor, estado REGISTADO/CONFIRMADO/ESTORNADO). Valor nunca editável. **Regra de estado:** `ESTORNADO` só quando Σ estornos APROVADOS = valor do pagamento. Estorno parcial mantém `CONFIRMADO`; o valor líquido (valor − Σ estornos aprovados) é calculado e mostrado no extracto e no recibo (nota "estorno parcial de X Kz"). Estorno PROPOSTO não altera o estado.
- **AlocacaoPagamento** (pagamento, encargo, valor > 0). Regra: Σ alocações ≤ valor do pagamento (verificada em transacção + constraint trigger).
- **Recibo** (série, número sequencial sem saltos, pagamento UNIQUE, pdfDocumento, emitidoPor). UNIQUE(série, número).
- **Estorno** (pagamento, motivo, proposto por, autorizado por ≠ proponente, valor > 0, estado PROPOSTO/APROVADO/REJEITADO). Estorno total ou parcial.
- **EstornoAlocacao** (estorno, alocação original, valor > 0): reverte, no todo ou em parte, uma alocação concreta. Regras (transacção + constraint trigger): Σ EstornoAlocacao de uma alocação ≤ valor dessa alocação; Σ EstornoAlocacao de um estorno = valor do estorno. Todos os valores permanecem positivos; o sentido é dado pela tabela. Só existe depois de o estorno ser APROVADO.
- **Saldo do encargo** = valor − (Σ AlocacaoPagamento − Σ EstornoAlocacao); **saldo do estudante** = Σ saldos dos seus encargos; vista/consulta, nunca coluna editável.

### Pedidos e documentos
- **PedidoDeclaracao** (tipo, estudante, solicitante, estado PEDIDO/EM_ANALISE/APROVADO/EMITIDO/REJEITADO, motivo, histórico).
- **Documento** (tipo, entidade ligada, caminho privado, hash SHA-256, emitidoPor).

### Transversal
- **Notificacao** (destinatário, canal APP/EMAIL, título, corpo, lidaEm).
- **EventoAuditoria** (actor, acção, entidade, entidadeId, antes, depois, ip, data) — só inserção.
- **LoteMigracao** / **ErroMigracao** (ficheiro, folha, linha, coluna, valor, motivo).

### 2.1 Unidade monetária (provisória — a confirmar com a escola)
- **Apresentação:** Kz inteiros, sem decimais (ex.: `15 000 Kz`).
- **Armazenamento:** `BigInt` em cêntimos (ex.: 15 000 Kz → `1500000`). Conversão única em `src/lib/dinheiro` (`kzParaCentimos`, `centimosParaKz`); nenhum outro código multiplica/divide por 100.
- `BigInt` (e não `Int` de 32 bits, máx. ≈ 21 milhões de Kz) para totais e relatórios não transbordarem.
- Importação Excel: valores em Kz inteiros → ×100; valores com decimais são rejeitados para revisão.

## 3. Integridade em base de dados
- Índices em todas as FKs e em nome, numeroProcesso, BI.
- CHECK em valores monetários; UNIQUE parciais (ano activo, matrícula activa).
- Triggers: bloquear UPDATE/DELETE em `Pagamento` (excepto transição de estado permitida), `AlocacaoPagamento`, `Estorno` (excepto transição de estado), `EstornoAlocacao`, `Recibo`, `EventoAuditoria`.
- Sequência de recibos por tabela de contadores com bloqueio de linha.

## 4. Questões em aberto
- Ligação Estudante–Encarregado: só um encarregado "principal" por estudante?
- Estados exactos da matrícula (ACTIVA, TRANSFERIDA, ANULADA, CONCLUIDA)?
- Transições de estado do Pagamento (REGISTADO→CONFIRMADO por quem?) — propor: Financeiro regista, Direcção/Financeiro sénior confirma (D3).

## 5. Estado de implementação — Entrega C (2026-10-13)
Entidades criadas: `Periodo`, `Disciplina`, `Funcionario`, `TurmaDisciplina`, `Encarregado`, `EstudanteEncarregado`, `Matricula`; campos novos em `Turma` (`directorId`), `Estudante` (`bi`, `contacto`, `estado`).

Garantias na base de dados (migração `20261013220000_estrutura_escolar`):
| Garantia | Mecanismo |
|---|---|
| Uma matrícula ACTIVA por estudante e ano | Índice único parcial `Matricula_uma_activa_por_ano` |
| Turma do mesmo ano da matrícula | FK composta `(turmaId, anoLectivoId)` → `Turma(id, anoLectivoId)` |
| Matrícula inicial («Nova») única por estudante | Índice único parcial `Matricula_uma_nova_por_estudante` (migração `20261015100000_matricula_nova_unica`) |
| Um só ano lectivo ACTIVO | Índice único parcial `AnoLectivo_um_activo` |
| Um só encarregado principal por estudante | Índice único parcial `EstudanteEncarregado_um_principal` |
| Datas coerentes (ano, período, validade) | `CHECK` |
| Um estudante/encarregado por conta; BI único | `UNIQUE` |

Decisões e justificação: `docs/decisions/ADR-0002-estrutura-escolar-e-matriculas.md`.

## 6. Estado de implementação — Entrega D (2026-10-16)
Entidades: `Avaliacao`, `Nota`, `PautaPublicacao`; `Periodo` ganha `UNIQUE(id, anoLectivoId)` e `TurmaDisciplina` `UNIQUE(id, turmaId)` para as chaves compostas.

| Garantia | Mecanismo |
|---|---|
| A disciplina da avaliação é da turma; o período é do mesmo ano da turma | FK compostas em `Avaliacao` e `PautaPublicacao` |
| Nota de 0 a 20 (centésimas, 0–2000); peso de 1 a 100 | `CHECK` |
| Uma nota por estudante e avaliação | `UNIQUE(avaliacaoId, estudanteId)` |
| Estado da pauta coerente com as datas | `CHECK` `Pauta_estado_ck` |
| Transições RASCUNHO→VALIDADA→PUBLICADA (e VALIDADA→RASCUNHO); PUBLICADA definitiva; pautas não se apagam | Gatilho `pauta_transicao` |
| Notas e avaliações imutáveis com a pauta VALIDADA/PUBLICADA (verifica pauta antiga e nova; chaves imutáveis) | Gatilhos `nota_bloqueada` e `avaliacao_bloqueada`; só o DONO das tabelas os contorna |
| Uma pauta só nasce em RASCUNHO; PUBLICADA é imutável; `TRUNCATE` travado | Gatilhos `pauta_transicao`, `*_sem_truncate` |
| Correcção de nota publicada | Função `corrigir_nota_publicada(nota, valor, token_sessao, motivo, ip)` (SECURITY DEFINER): autentica o autor pela sessão, exige a permissão `notas:corrigir`, valida e audita na mesma transacção |
| A aplicação não é dona das tabelas | Papel `lamanus_app` (`docker/db/papeis.sql`, `prisma/grants.sql`); auditoria sem UPDATE/DELETE/TRUNCATE; pautas sem DELETE/TRUNCATE |

Decisões: `docs/decisions/ADR-0003-avaliacao-e-pautas.md`.

## 7. Estado de implementação — Entrega E (2026-10-17)

Migração `20261017100000_financeiro`. Tabelas: `TipoEncargo`, `Encargo` (única por estudante+tipo+referência; valor imutável), `Pagamento` (REGISTADO → CONFIRMADO → ESTORNADO, ou REGISTADO → ANULADO), `AlocacaoPagamento` (chaves compostas garantem que pagamento e encargo são do mesmo estudante), `Estorno`/`EstornoAlocacao` (movimento inverso), `SerieRecibo` (contador por série e ano) e `Recibo` (único por pagamento e por série+ano+número).

- Todos os valores em `BIGINT` cêntimos, com `CHECK` de limites (≤ 10^12) e positividade.
- Vista `VistaEncargo` (pago = Σ alocações − Σ movimentos inversos). O estado do encargo (pendente/parcial/pago/vencido/anulado) calcula-se com `estadoEncargo` e o dia de hoje em Africa/Luanda.
- **Saldo** (nunca guardado): em dívida = Σ encargos activos − Σ alocações líquidas; crédito = Σ (pagamento − estornado − alocado líquido) dos pagamentos confirmados.
- Funções de reconciliação: `reconciliacao_financeira(estudantes)` e `reconciliacao_numeracao()` (vazio = coerente).
