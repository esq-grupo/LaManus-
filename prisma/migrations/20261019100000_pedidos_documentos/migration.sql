-- CreateEnum
CREATE TYPE "TipoDeclaracao" AS ENUM ('MATRICULA', 'FREQUENCIA', 'SITUACAO_FINANCEIRA');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('PEDIDO', 'APROVADO', 'REJEITADO', 'EMITIDA', 'CANCELADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacao" ADD VALUE 'PEDIDO_APROVADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'PEDIDO_REJEITADO';
ALTER TYPE "TipoNotificacao" ADD VALUE 'DECLARACAO_EMITIDA';

-- CreateTable
CREATE TABLE "PedidoDeclaracao" (
    "id" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "tipo" "TipoDeclaracao" NOT NULL,
    "finalidade" TEXT NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'PEDIDO',
    "pedidoPorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoPorId" UUID,
    "decididoEm" TIMESTAMP(3),
    "motivoDecisao" TEXT,
    "emitidoPorId" UUID,
    "emitidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "PedidoDeclaracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclaracaoEmitida" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "serie" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "emitidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeclaracaoEmitida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerieDocumento" (
    "serie" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "proximo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SerieDocumento_pkey" PRIMARY KEY ("serie","ano")
);

-- CreateIndex
CREATE INDEX "PedidoDeclaracao_estudanteId_createdAt_idx" ON "PedidoDeclaracao"("estudanteId", "createdAt");

-- CreateIndex
CREATE INDEX "PedidoDeclaracao_estado_createdAt_idx" ON "PedidoDeclaracao"("estado", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeclaracaoEmitida_pedidoId_key" ON "DeclaracaoEmitida"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "DeclaracaoEmitida_codigo_key" ON "DeclaracaoEmitida"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "DeclaracaoEmitida_serie_ano_numero_key" ON "DeclaracaoEmitida"("serie", "ano", "numero");

-- AddForeignKey
ALTER TABLE "PedidoDeclaracao" ADD CONSTRAINT "PedidoDeclaracao_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaracaoEmitida" ADD CONSTRAINT "DeclaracaoEmitida_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoDeclaracao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ Garantias na base de dados (ADR-0006) ═══════════════════════════════════════════════════════════
ALTER TABLE "PedidoDeclaracao" ADD CONSTRAINT "Pedido_finalidade_ck" CHECK (length(btrim("finalidade")) >= 3 AND length("finalidade") <= 300);
-- Quem pede não decide; quem decide não emite (controlo duplo, por restrição).
ALTER TABLE "PedidoDeclaracao" ADD CONSTRAINT "Pedido_controlo_ck" CHECK (
  ("decididoPorId" IS NULL OR "decididoPorId" <> "pedidoPorId")
  AND ("emitidoPorId" IS NULL OR "decididoPorId" IS NULL OR "emitidoPorId" <> "decididoPorId"));
ALTER TABLE "PedidoDeclaracao" ADD CONSTRAINT "Pedido_estado_ck" CHECK (
  ("estado" = 'PEDIDO' AND "decididoPorId" IS NULL AND "emitidoPorId" IS NULL AND "canceladoEm" IS NULL)
  OR ("estado" = 'APROVADO' AND "decididoPorId" IS NOT NULL AND "decididoEm" IS NOT NULL AND "emitidoPorId" IS NULL AND "canceladoEm" IS NULL)
  OR ("estado" = 'REJEITADO' AND "decididoPorId" IS NOT NULL AND "decididoEm" IS NOT NULL AND length(btrim(coalesce("motivoDecisao", ''))) >= 5 AND "emitidoPorId" IS NULL AND "canceladoEm" IS NULL)
  OR ("estado" = 'EMITIDA' AND "decididoPorId" IS NOT NULL AND "decididoEm" IS NOT NULL AND "emitidoPorId" IS NOT NULL AND "emitidoEm" IS NOT NULL AND "canceladoEm" IS NULL)
  OR ("estado" = 'CANCELADO' AND "canceladoEm" IS NOT NULL AND "decididoPorId" IS NULL AND "emitidoPorId" IS NULL));
ALTER TABLE "DeclaracaoEmitida" ADD CONSTRAINT "Declaracao_numero_ck" CHECK ("numero" > 0 AND length("codigo") >= 12);

CREATE OR REPLACE FUNCTION pedido_declaracao_guarda() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Pedidos não se apagam (cancele-os)'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'PEDIDO' THEN RAISE EXCEPTION 'Um pedido nasce no estado PEDIDO'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."estudanteId" <> OLD."estudanteId" OR NEW."anoLectivoId" <> OLD."anoLectivoId" OR NEW.tipo <> OLD.tipo
     OR NEW.finalidade <> OLD.finalidade OR NEW."pedidoPorId" <> OLD."pedidoPorId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'Os dados de um pedido não se alteram';
  END IF;
  IF NEW.estado = OLD.estado THEN
    IF NEW."decididoPorId" IS DISTINCT FROM OLD."decididoPorId" OR NEW."decididoEm" IS DISTINCT FROM OLD."decididoEm"
       OR NEW."motivoDecisao" IS DISTINCT FROM OLD."motivoDecisao" OR NEW."emitidoPorId" IS DISTINCT FROM OLD."emitidoPorId"
       OR NEW."emitidoEm" IS DISTINCT FROM OLD."emitidoEm" OR NEW."canceladoEm" IS DISTINCT FROM OLD."canceladoEm" THEN
      RAISE EXCEPTION 'Sem alterações permitidas neste pedido';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.estado = 'PEDIDO' AND NEW.estado IN ('APROVADO', 'REJEITADO', 'CANCELADO') THEN RETURN NEW; END IF;
  IF OLD.estado = 'APROVADO' AND NEW.estado = 'EMITIDA' THEN
    IF NOT EXISTS (SELECT 1 FROM "DeclaracaoEmitida" WHERE "pedidoId" = OLD.id) THEN RAISE EXCEPTION 'Não há documento emitido para este pedido'; END IF;
    IF NEW."decididoPorId" IS DISTINCT FROM OLD."decididoPorId" OR NEW."decididoEm" IS DISTINCT FROM OLD."decididoEm" THEN
      RAISE EXCEPTION 'A decisão não se altera ao emitir';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Transição de pedido inválida: % → %', OLD.estado, NEW.estado;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pedido_declaracao_guarda BEFORE INSERT OR UPDATE OR DELETE ON "PedidoDeclaracao" FOR EACH ROW EXECUTE FUNCTION pedido_declaracao_guarda();

-- O documento emitido é um instantâneo imutável; só se cria para um pedido APROVADO.
CREATE OR REPLACE FUNCTION declaracao_emitida_guarda() RETURNS trigger AS $$
DECLARE v_estado "EstadoPedido";
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Um documento emitido não se altera'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Um documento emitido não se apaga'; END IF;
    RETURN OLD;
  END IF;
  SELECT estado INTO v_estado FROM "PedidoDeclaracao" WHERE id = NEW."pedidoId" FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'APROVADO' THEN RAISE EXCEPTION 'Só se emite um pedido aprovado'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER declaracao_emitida_guarda BEFORE INSERT OR UPDATE OR DELETE ON "DeclaracaoEmitida" FOR EACH ROW EXECUTE FUNCTION declaracao_emitida_guarda();
CREATE TRIGGER declaracao_sem_truncate BEFORE TRUNCATE ON "DeclaracaoEmitida" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER pedido_declaracao_sem_truncate BEFORE TRUNCATE ON "PedidoDeclaracao" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER serie_documento_sem_truncate BEFORE TRUNCATE ON "SerieDocumento" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
