-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('PAUTA_PUBLICADA', 'NOTA_CORRIGIDA', 'RECIBO_EMITIDO');

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "estudanteId" UUID,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "lidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacao_userId_lidaEm_createdAt_idx" ON "Notificacao"("userId", "lidaEm", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacao_userId_chave_key" ON "Notificacao"("userId", "chave");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Um aviso não se reescreve: só se pode marcar como lido (uma vez). Evita que um erro da aplicação altere o texto ou «des-leia».
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_texto_ck" CHECK (length(btrim("titulo")) > 0 AND length("titulo") <= 200 AND length("corpo") <= 1000);

CREATE OR REPLACE FUNCTION notificacao_guarda() RETURNS trigger AS $$
BEGIN
  IF NEW."userId" <> OLD."userId" OR NEW."estudanteId" IS DISTINCT FROM OLD."estudanteId" OR NEW.tipo <> OLD.tipo
     OR NEW.titulo <> OLD.titulo OR NEW.corpo <> OLD.corpo OR NEW.chave <> OLD.chave OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'Um aviso não se altera (só se marca como lido)';
  END IF;
  IF OLD."lidaEm" IS NOT NULL AND NEW."lidaEm" IS DISTINCT FROM OLD."lidaEm" THEN
    RAISE EXCEPTION 'Um aviso lido não volta a não lido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER notificacao_guarda BEFORE UPDATE ON "Notificacao" FOR EACH ROW EXECUTE FUNCTION notificacao_guarda();
