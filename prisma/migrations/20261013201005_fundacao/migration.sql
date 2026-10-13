-- CreateEnum
CREATE TYPE "EstadoAnoLectivo" AS ENUM ('PLANEADO', 'ACTIVO', 'FECHADO');

-- CreateTable
CREATE TABLE "AnoLectivo" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "estado" "EstadoAnoLectivo" NOT NULL DEFAULT 'PLANEADO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnoLectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turma" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "classeId" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Turma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estudante" (
    "id" UUID NOT NULL,
    "numeroProcesso" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estudante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnoLectivo_nome_key" ON "AnoLectivo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_nome_key" ON "Classe"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Classe_ordem_key" ON "Classe"("ordem");

-- CreateIndex
CREATE INDEX "Turma_classeId_idx" ON "Turma"("classeId");

-- CreateIndex
CREATE INDEX "Turma_anoLectivoId_idx" ON "Turma"("anoLectivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_anoLectivoId_classeId_nome_key" ON "Turma"("anoLectivoId", "classeId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Estudante_numeroProcesso_key" ON "Estudante"("numeroProcesso");

-- CreateIndex
CREATE INDEX "Estudante_nome_idx" ON "Estudante"("nome");

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_classeId_fkey" FOREIGN KEY ("classeId") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_anoLectivoId_fkey" FOREIGN KEY ("anoLectivoId") REFERENCES "AnoLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
