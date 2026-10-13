# Modelo de dados — Lá Manu (versão Entrega 0, a refinar na Entrega A)

Convenções: `id` UUID · `createdAt`, `updatedAt`, `createdById` · dinheiro `Int` (cêntimos de Kz) · `archivedAt` (soft delete) nas entidades académicas · **movimentos financeiros nunca se apagam nem editam**.

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
- **Pagamento** (estudante, pagoPor opcional, valor > 0, método, referenciaExterna, data, registadoPor, estado REGISTADO/CONFIRMADO/ESTORNADO). Valor nunca editável.
- **AlocacaoPagamento** (pagamento, encargo, valor > 0). Regra: Σ alocações ≤ valor do pagamento (verificada em transacção + constraint trigger).
- **Recibo** (série, número sequencial sem saltos, pagamento UNIQUE, pdfDocumento, emitidoPor). UNIQUE(série, número).
- **Estorno** (pagamento, motivo, proposto por, autorizado por ≠ proponente) → gera movimento inverso (alocações negativas registadas como linhas de estorno).
- **Saldo** = Σ encargos − Σ alocações líquidas de estornos; vista/consulta, nunca coluna editável.

### Pedidos e documentos
- **PedidoDeclaracao** (tipo, estudante, solicitante, estado PEDIDO/EM_ANALISE/APROVADO/EMITIDO/REJEITADO, motivo, histórico).
- **Documento** (tipo, entidade ligada, caminho privado, hash SHA-256, emitidoPor).

### Transversal
- **Notificacao** (destinatário, canal APP/EMAIL, título, corpo, lidaEm).
- **EventoAuditoria** (actor, acção, entidade, entidadeId, antes, depois, ip, data) — só inserção.
- **LoteMigracao** / **ErroMigracao** (ficheiro, folha, linha, coluna, valor, motivo).

## 3. Integridade em base de dados
- Índices em todas as FKs e em nome, numeroProcesso, BI.
- CHECK em valores monetários; UNIQUE parciais (ano activo, matrícula activa).
- Triggers: bloquear UPDATE/DELETE em `Pagamento` (excepto transição de estado permitida), `AlocacaoPagamento`, `Recibo`, `EventoAuditoria`.
- Sequência de recibos por tabela de contadores com bloqueio de linha.

## 4. Questões em aberto
- Ligação Estudante–Encarregado: só um encarregado "principal" por estudante?
- Estados exactos da matrícula (ACTIVA, TRANSFERIDA, ANULADA, CONCLUIDA)?
- Transições de estado do Pagamento (REGISTADO→CONFIRMADO por quem?) — propor: Financeiro regista, Direcção/Financeiro sénior confirma (D3).
