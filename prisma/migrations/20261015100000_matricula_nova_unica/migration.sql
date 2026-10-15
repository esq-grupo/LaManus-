-- Matrícula inicial («Nova») única por estudante, garantida pela BD (a regra no código tinha uma janela de corrida:
-- dois pedidos simultâneos «Nova» para anos diferentes passavam ambos a verificação).
-- Conta ACTIVA e CONCLUIDA. Ficam de fora: TRANSFERIDA (a sucessora herda o tipo e é que conta) e ANULADA (permite recomeçar).
CREATE UNIQUE INDEX "Matricula_uma_nova_por_estudante" ON "Matricula" ("estudanteId") WHERE "tipo" = 'NOVA' AND "estado" IN ('ACTIVA', 'CONCLUIDA');
