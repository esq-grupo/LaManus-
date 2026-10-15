-- CreateEnum
CREATE TYPE "TipoAvaliacao" AS ENUM ('TESTE', 'TRABALHO', 'EXAME', 'PARTICIPACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "EstadoPauta" AS ENUM ('RASCUNHO', 'VALIDADA', 'PUBLICADA');

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" UUID NOT NULL,
    "turmaDisciplinaId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "periodoId" UUID NOT NULL,
    "tipo" "TipoAvaliacao" NOT NULL,
    "nome" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" UUID NOT NULL,
    "avaliacaoId" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "valor" INTEGER NOT NULL,
    "lancadaPorId" UUID,
    "lancadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PautaPublicacao" (
    "id" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "periodoId" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "estado" "EstadoPauta" NOT NULL DEFAULT 'RASCUNHO',
    "validadaPorId" UUID,
    "validadaEm" TIMESTAMP(3),
    "publicadaPorId" UUID,
    "publicadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PautaPublicacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avaliacao_turmaDisciplinaId_idx" ON "Avaliacao"("turmaDisciplinaId");

-- CreateIndex
CREATE INDEX "Avaliacao_turmaId_periodoId_idx" ON "Avaliacao"("turmaId", "periodoId");

-- CreateIndex
CREATE INDEX "Avaliacao_periodoId_idx" ON "Avaliacao"("periodoId");

-- CreateIndex
CREATE INDEX "Nota_estudanteId_idx" ON "Nota"("estudanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Nota_avaliacaoId_estudanteId_key" ON "Nota"("avaliacaoId", "estudanteId");

-- CreateIndex
CREATE INDEX "PautaPublicacao_periodoId_idx" ON "PautaPublicacao"("periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "PautaPublicacao_turmaId_periodoId_key" ON "PautaPublicacao"("turmaId", "periodoId");

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_id_anoLectivoId_key" ON "Periodo"("id", "anoLectivoId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaDisciplina_id_turmaId_key" ON "TurmaDisciplina"("id", "turmaId");

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_turmaDisciplinaId_turmaId_fkey" FOREIGN KEY ("turmaDisciplinaId", "turmaId") REFERENCES "TurmaDisciplina"("id", "turmaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_turmaId_anoLectivoId_fkey" FOREIGN KEY ("turmaId", "anoLectivoId") REFERENCES "Turma"("id", "anoLectivoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_periodoId_anoLectivoId_fkey" FOREIGN KEY ("periodoId", "anoLectivoId") REFERENCES "Periodo"("id", "anoLectivoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "Avaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PautaPublicacao" ADD CONSTRAINT "PautaPublicacao_turmaId_anoLectivoId_fkey" FOREIGN KEY ("turmaId", "anoLectivoId") REFERENCES "Turma"("id", "anoLectivoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PautaPublicacao" ADD CONSTRAINT "PautaPublicacao_periodoId_anoLectivoId_fkey" FOREIGN KEY ("periodoId", "anoLectivoId") REFERENCES "Periodo"("id", "anoLectivoId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ Garantias de integridade na base de dados ═══

-- Valores válidos: nota de 0,00 a 20,00 (em centésimas); peso de 1 a 100.
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_valor_ck" CHECK ("valor" BETWEEN 0 AND 2000);
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_peso_ck" CHECK ("peso" BETWEEN 1 AND 100);

-- Coerência do estado da pauta com as datas/autores.
ALTER TABLE "PautaPublicacao" ADD CONSTRAINT "Pauta_estado_ck" CHECK (
  ("estado" = 'RASCUNHO' AND "publicadaEm" IS NULL)
  OR ("estado" = 'VALIDADA' AND "validadaEm" IS NOT NULL AND "publicadaEm" IS NULL)
  OR ("estado" = 'PUBLICADA' AND "validadaEm" IS NOT NULL AND "publicadaEm" IS NOT NULL)
);

-- Transições permitidas da pauta: RASCUNHO → VALIDADA → PUBLICADA, e VALIDADA → RASCUNHO (reabrir).
-- PUBLICADA é definitiva (correcções fazem-se nota a nota, com motivo e auditoria). Não se apagam pautas.
CREATE OR REPLACE FUNCTION pauta_transicao_valida() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('app.permitir_correcao', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Pautas não se apagam';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW."turmaId" <> OLD."turmaId" OR NEW."periodoId" <> OLD."periodoId" THEN
    RAISE EXCEPTION 'A turma e o período de uma pauta não mudam';
  END IF;
  IF NEW.estado <> OLD.estado AND NOT (
       (OLD.estado = 'RASCUNHO' AND NEW.estado = 'VALIDADA')
    OR (OLD.estado = 'VALIDADA' AND NEW.estado IN ('PUBLICADA', 'RASCUNHO'))
  ) THEN
    RAISE EXCEPTION 'Transição de pauta inválida: % → %', OLD.estado, NEW.estado;
  END IF;
  IF OLD.estado = 'PUBLICADA' AND (NEW.estado <> OLD.estado OR NEW."publicadaEm" IS DISTINCT FROM OLD."publicadaEm") THEN
    RAISE EXCEPTION 'Uma pauta publicada é definitiva';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pauta_transicao BEFORE UPDATE OR DELETE ON "PautaPublicacao" FOR EACH ROW EXECUTE FUNCTION pauta_transicao_valida();

-- Notas e avaliações só mudam enquanto a pauta está em RASCUNHO. Depois de validada/publicada só o serviço de correção
-- (que activa `app.permitir_correcao` na sua transacção) pode alterar uma nota. Vale para QUALQUER caminho de acesso à BD.
CREATE OR REPLACE FUNCTION nota_pauta_bloqueada() RETURNS trigger AS $$
DECLARE
  v_turma uuid; v_periodo uuid; v_estado "EstadoPauta";
BEGIN
  IF TG_TABLE_NAME = 'Nota' THEN
    SELECT a."turmaId", a."periodoId" INTO v_turma, v_periodo FROM "Avaliacao" a WHERE a.id = COALESCE(NEW."avaliacaoId", OLD."avaliacaoId");
  ELSE
    v_turma := COALESCE(NEW."turmaId", OLD."turmaId");
    v_periodo := COALESCE(NEW."periodoId", OLD."periodoId");
  END IF;
  SELECT p.estado INTO v_estado FROM "PautaPublicacao" p WHERE p."turmaId" = v_turma AND p."periodoId" = v_periodo;
  IF v_estado IS NOT NULL AND v_estado <> 'RASCUNHO' AND current_setting('app.permitir_correcao', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'A pauta está % e já não aceita alterações (use a correcção com motivo)', v_estado;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER nota_bloqueada BEFORE INSERT OR UPDATE OR DELETE ON "Nota" FOR EACH ROW EXECUTE FUNCTION nota_pauta_bloqueada();
CREATE TRIGGER avaliacao_bloqueada BEFORE INSERT OR UPDATE OR DELETE ON "Avaliacao" FOR EACH ROW EXECUTE FUNCTION nota_pauta_bloqueada();
