-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('APLICADO', 'REVERTIDO');

-- CreateTable
CREATE TABLE "LoteMigracao" (
    "id" UUID NOT NULL,
    "ficheiro" TEXT NOT NULL,
    "ficheiroSha256" TEXT NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'APLICADO',
    "resumo" JSONB NOT NULL,
    "manifesto" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertidoEm" TIMESTAMP(3),

    CONSTRAINT "LoteMigracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoteMigracao_criadoEm_idx" ON "LoteMigracao"("criadoEm");

