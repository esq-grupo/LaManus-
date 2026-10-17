# ADR-0004 — Financeiro base: encargos, pagamentos, recibos, estornos e saldos

- **Data:** 2026-10-17
- **Estado:** Provisória (D5, D6, D7 por confirmar com a escola; decisão 4 a confirmar pelo PO)
- **Responsável:** Claude Code (construtor); aprovação: Escola / E-ESQ

## Contexto
Esta é a entrega de maior risco: erros aqui são erros de dinheiro. Princípios do guião: valores em inteiros, movimentos imutáveis, correcção por estorno, recibos sem saltos, saldo sempre calculado. Aplicam-se as lições das entregas anteriores: regras na base de dados e testadas com o papel restrito da aplicação; transições sensíveis por funções que autenticam o autor pela sessão; auditoria na mesma transacção; testes de concorrência; validação dos testes por mutação.

## Decisões
1. **Dinheiro em `BigInt` de cêntimos** (`src/lib/dinheiro.ts`); mostrado em Kz inteiros. `CHECK`: encargos ≥ 0; pagamentos, alocações e estornos > 0.
2. **Livro de movimentos imutável.** `Pagamento`, `AlocacaoPagamento`, `Estorno`, `EstornoAlocacao` e `Recibo` nunca se apagam; o valor de um pagamento nunca muda. Correcções fazem-se por estorno (movimento inverso). A aplicação nem tem privilégio de `UPDATE`/`DELETE` nas tabelas de movimentos (excepto transições permitidas) — gatilhos repetem a regra para o próprio dono.
3. **Saldo nunca é um campo.** Saldo de um encargo = valor − (Σ alocações − Σ estornos de alocação). Saldo do estudante = Σ dos saldos dos encargos não anulados. O excedente de um pagamento sem encargo para pagar é **crédito** (calculado, não editável).
4. **Pagamento em dois passos (controlo duplo).** Quem regista (Financeiro) cria o pagamento `REGISTADO`, sem efeito nos saldos; quem **confirma** (Direcção, permissão nova `pagamento:confirmar`) é **obrigatoriamente outra pessoa** e só então se geram as alocações e o recibo. *Decisão a confirmar pelo PO.* O estado `CONFIRMADO` só se atinge pela função `confirmar_pagamento` da BD: o papel da aplicação não consegue pôr um pagamento em `CONFIRMADO` por SQL directo.
5. **Confirmar = uma só transacção na BD** (`confirmar_pagamento`, `SECURITY DEFINER`, autentica o autor pelo token de sessão como a correcção de notas): valida a permissão e a separação de funções, **aloca ao encargo mais antigo** (D6; vencimento, depois criação), cria as alocações, emite o recibo e audita. Falhou uma parte → nada fica.
6. **Recibos sem saltos.** Contador por série e ano numa tabela com linha bloqueada (`FOR UPDATE`), incrementado **na mesma transacção** que cria o recibo: se algo falhar, o número volta a ficar disponível (uma `SEQUENCE` do PostgreSQL teria saltos). Recibo imutável, `UNIQUE(série, ano, número)`, um por pagamento. PDF gerado no servidor a partir dos dados (sem ficheiro guardado), com verificação de permissão a cada descarga.
7. **Estorno com aprovação e movimento inverso.** O Financeiro **propõe** (`estorno:propor`); a Direcção **aprova** (`estorno:aprovar`), nunca a mesma pessoa; a aprovação (função `aprovar_estorno`) reverte as alocações mais recentes primeiro (`EstornoAlocacao`, sempre valores positivos) e a parte que era crédito; o pagamento passa a `ESTORNADO` só quando totalmente revertido. Estorno parcial permitido. O recibo mantém-se (o documento original), com a nota de estorno no extracto.
8. **Encargos:** tipos configuráveis (propina, matrícula, uniforme, taxa); geração em lote **idempotente** (`UNIQUE(estudante, tipo, referência)`: voltar a gerar não duplica); propinas mensais, 10 meses, sem multa automática (D5). Valor de um encargo nunca é editado: anula-se (só sem alocações líquidas, com motivo) e cria-se outro.
9. **Escopo de leitura:** Direcção, Secretaria e Financeiro vêem todos; Estudante só o próprio; Encarregado só os educandos verificados e activos (mesmo escopo das notas). Docente, Qualidade, RH e Admin técnico: nenhum. Vencimento comparado com o dia de `Africa/Luanda`.
10. **Reconciliação** verificável em SQL e por serviço: Σ alocações ≤ Σ pagamentos confirmados; saldo = Σ encargos − Σ alocações líquidas; um recibo por pagamento confirmado; numeração consecutiva por série e ano.

## Alternativas rejeitadas
| Alternativa | Motivo |
|---|---|
| Campo `saldo` no estudante | Pode divergir dos movimentos; o saldo calculado é sempre verdadeiro |
| Editar o valor de um pagamento | Perde rasto; a regra do guião é estorno |
| `SEQUENCE` do PostgreSQL para recibos | Tem saltos em caso de falha (viola «sem saltos») |
| Confirmar pagamentos pela aplicação com `UPDATE` | A aplicação (ou um erro de SQL) podia confirmar sem procedimento autorizado |
| Pagamento a mexer nos saldos logo ao ser registado | Sem controlo duplo; um erro de digitação afectava logo as contas |

## Limites
Aplicam-se os do ADR-0003 (decisão 13): quem tiver SQL arbitrário com o papel da aplicação pode criar sessões e papéis; o isolamento é trabalho obrigatório da Entrega H. Sem gateways de pagamento (D7) nem multas; sem notificações (Entrega F).
