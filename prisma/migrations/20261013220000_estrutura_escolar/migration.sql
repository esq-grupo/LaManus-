-- CreateEnum
CREATE TYPE "EstadoEstudante" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "TipoMatricula" AS ENUM ('NOVA', 'RENOVACAO');

-- CreateEnum
CREATE TYPE "EstadoMatricula" AS ENUM ('ACTIVA', 'TRANSFERIDA', 'ANULADA', 'CONCLUIDA');

-- AlterTable
ALTER TABLE "Estudante" ADD COLUMN     "bi" TEXT,
ADD COLUMN     "contacto" TEXT,
ADD COLUMN     "estado" "EstadoEstudante" NOT NULL DEFAULT 'ACTIVO';

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "directorId" UUID;

-- CreateTable
CREATE TABLE "Periodo" (
    "id" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,

    CONSTRAINT "Periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disciplina" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "userId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurmaDisciplina" (
    "id" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "disciplinaId" UUID NOT NULL,
    "docenteId" UUID,

    CONSTRAINT "TurmaDisciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encarregado" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "bi" TEXT,
    "contacto" TEXT,
    "userId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encarregado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstudanteEncarregado" (
    "estudanteId" UUID NOT NULL,
    "encarregadoId" UUID NOT NULL,
    "parentesco" TEXT NOT NULL,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "autorizacaoActiva" BOOLEAN NOT NULL DEFAULT true,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "validoDe" DATE,
    "validoAte" DATE,
    "verificadoPorId" UUID,
    "verificadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstudanteEncarregado_pkey" PRIMARY KEY ("estudanteId","encarregadoId")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "id" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "turmaId" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "tipo" "TipoMatricula" NOT NULL,
    "estado" "EstadoMatricula" NOT NULL DEFAULT 'ACTIVA',
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Periodo_anoLectivoId_idx" ON "Periodo"("anoLectivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_anoLectivoId_ordem_key" ON "Periodo"("anoLectivoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "Disciplina_nome_key" ON "Disciplina"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_userId_key" ON "Funcionario"("userId");

-- CreateIndex
CREATE INDEX "TurmaDisciplina_disciplinaId_idx" ON "TurmaDisciplina"("disciplinaId");

-- CreateIndex
CREATE INDEX "TurmaDisciplina_docenteId_idx" ON "TurmaDisciplina"("docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaDisciplina_turmaId_disciplinaId_key" ON "TurmaDisciplina"("turmaId", "disciplinaId");

-- CreateIndex
CREATE UNIQUE INDEX "Encarregado_bi_key" ON "Encarregado"("bi");

-- CreateIndex
CREATE UNIQUE INDEX "Encarregado_userId_key" ON "Encarregado"("userId");

-- CreateIndex
CREATE INDEX "Encarregado_nome_idx" ON "Encarregado"("nome");

-- CreateIndex
CREATE INDEX "EstudanteEncarregado_encarregadoId_idx" ON "EstudanteEncarregado"("encarregadoId");

-- CreateIndex
CREATE INDEX "Matricula_estudanteId_idx" ON "Matricula"("estudanteId");

-- CreateIndex
CREATE INDEX "Matricula_turmaId_idx" ON "Matricula"("turmaId");

-- CreateIndex
CREATE INDEX "Matricula_anoLectivoId_idx" ON "Matricula"("anoLectivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Estudante_bi_key" ON "Estudante"("bi");

-- CreateIndex
CREATE INDEX "Turma_directorId_idx" ON "Turma"("directorId");

-- CreateIndex
CREATE UNIQUE INDEX "Turma_id_anoLectivoId_key" ON "Turma"("id", "anoLectivoId");

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Periodo" ADD CONSTRAINT "Periodo_anoLectivoId_fkey" FOREIGN KEY ("anoLectivoId") REFERENCES "AnoLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDisciplina" ADD CONSTRAINT "TurmaDisciplina_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDisciplina" ADD CONSTRAINT "TurmaDisciplina_disciplinaId_fkey" FOREIGN KEY ("disciplinaId") REFERENCES "Disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDisciplina" ADD CONSTRAINT "TurmaDisciplina_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encarregado" ADD CONSTRAINT "Encarregado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstudanteEncarregado" ADD CONSTRAINT "EstudanteEncarregado_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstudanteEncarregado" ADD CONSTRAINT "EstudanteEncarregado_encarregadoId_fkey" FOREIGN KEY ("encarregadoId") REFERENCES "Encarregado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_anoLectivoId_fkey" FOREIGN KEY ("anoLectivoId") REFERENCES "AnoLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_turmaId_anoLectivoId_fkey" FOREIGN KEY ("turmaId", "anoLectivoId") REFERENCES "Turma"("id", "anoLectivoId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══ Garantias de integridade na base de dados (o Prisma não modela índices parciais nem CHECK) ═══
-- NOTA: ao gerar migrações futuras com `migrate diff` contra a BD viva, rever sempre que estes índices não são removidos.

-- Um estudante só pode ter UMA matrícula activa por ano lectivo.
CREATE UNIQUE INDEX "Matricula_uma_activa_por_ano" ON "Matricula" ("estudanteId", "anoLectivoId") WHERE "estado" = 'ACTIVA';

-- Só um ano lectivo ACTIVO de cada vez.
CREATE UNIQUE INDEX "AnoLectivo_um_activo" ON "AnoLectivo" ((true)) WHERE "estado" = 'ACTIVO';

-- Datas coerentes.
ALTER TABLE "AnoLectivo" ADD CONSTRAINT "AnoLectivo_datas_ck" CHECK ("fim" > "inicio");
ALTER TABLE "Periodo" ADD CONSTRAINT "Periodo_datas_ck" CHECK ("fim" > "inicio");
ALTER TABLE "EstudanteEncarregado" ADD CONSTRAINT "EstudanteEncarregado_validade_ck" CHECK ("validoAte" IS NULL OR "validoDe" IS NULL OR "validoAte" >= "validoDe");

-- Um estudante tem no máximo um encarregado "principal".
CREATE UNIQUE INDEX "EstudanteEncarregado_um_principal" ON "EstudanteEncarregado" ("estudanteId") WHERE "principal" = true;
