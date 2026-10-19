-- Revisão do Codex à Entrega G: pedidos simultâneos do mesmo tipo podiam criar duplicados (a verificação era só na aplicação).
-- Um estudante só pode ter UM pedido em curso (por decidir ou aprovado) de cada tipo; imposto pela base de dados.
CREATE UNIQUE INDEX "Pedido_um_em_curso_por_tipo" ON "PedidoDeclaracao" ("estudanteId", "tipo") WHERE "estado" IN ('PEDIDO', 'APROVADO');
