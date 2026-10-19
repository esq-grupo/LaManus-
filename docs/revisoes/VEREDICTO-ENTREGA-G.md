# Veredicto — Entrega G (Codex, revisão n.º 1)

**APROVADO COM RESSALVAS.** CI do commit `c10af58` verde à primeira tentativa (`verificar` e `compose`).

## Ressalvas (duas corridas, a corrigir antes do piloto)
1. Pedidos simultâneos do mesmo tipo podiam criar duplicados (a verificação era só na aplicação).
2. A matrícula e a situação financeira eram validadas antes da transacção que grava o documento: o PDF podia ficar desactualizado se os dados mudassem nesse intervalo.

## Resposta
1. **Duplicados:** índice único parcial na BD (`Pedido_um_em_curso_por_tipo`: um estudante só tem um pedido em curso — por decidir ou aprovado — de cada tipo; migração `20261019110000_pedidos_sem_duplicados`). A aplicação traduz a violação em mensagem em português. Testes: 6 pedidos simultâneos → fica 1; e a própria BD recusa um duplicado inserido directamente. Mutação (índice removido) → 2 testes falham; índice reposto.
2. **Validação e gravação numa só transacção** (`emitirDeclaracao`): pedido bloqueado (`FOR UPDATE`), matrícula bloqueada (`FOR SHARE`), validação (matrícula e saldo vencido) e gravação (número, instantâneo, estado, aviso, auditoria) na mesma transacção `SERIALIZABLE`, com repetição automática em conflito de serialização (SQLSTATE 40001). Teste: uma anulação de matrícula lançada logo após a validação **espera** pelo fim da emissão (não passa entre a validação e a gravação). Mutação (sem `FOR SHARE`) → o teste falha; código reposto e conferido por `md5`.
3. Durante a correcção o teste de 4 emissões simultâneas falhou: o Prisma devolve o conflito de serialização das consultas SQL directas como `P2010` (com «40001») e não como `P2034`; a repetição passou a reconhecer ambos. 6/6 execuções seguidas sem falhas depois.
- Local: 259 testes de unidade/integração (duas execuções seguidas) e e2e das declarações a passar.
