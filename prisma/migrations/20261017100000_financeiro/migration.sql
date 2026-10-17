-- CreateEnum
CREATE TYPE "Periodicidade" AS ENUM ('MENSAL', 'ANUAL', 'UNICO');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('TRANSFERENCIA', 'DEPOSITO', 'TPA', 'NUMERARIO');

-- CreateEnum
CREATE TYPE "EstadoPagamento" AS ENUM ('REGISTADO', 'CONFIRMADO', 'ESTORNADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "ModoAlocacao" AS ENUM ('AUTOMATICO', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoEstorno" AS ENUM ('PROPOSTO', 'APROVADO', 'REJEITADO');

-- CreateTable
CREATE TABLE "TipoEncargo" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "valorReferencia" BIGINT NOT NULL,
    "periodicidade" "Periodicidade" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoEncargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encargo" (
    "id" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "tipoEncargoId" UUID NOT NULL,
    "anoLectivoId" UUID NOT NULL,
    "referencia" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" BIGINT NOT NULL,
    "vencimento" DATE NOT NULL,
    "anuladoEm" TIMESTAMP(3),
    "anuladoPorId" UUID,
    "motivoAnulacao" TEXT,
    "criadoPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "referenciaExterna" TEXT,
    "nomePagador" TEXT,
    "dataPagamento" DATE NOT NULL,
    "modoAlocacao" "ModoAlocacao" NOT NULL DEFAULT 'AUTOMATICO',
    "estado" "EstadoPagamento" NOT NULL DEFAULT 'REGISTADO',
    "registadoPorId" UUID NOT NULL,
    "confirmadoPorId" UUID,
    "confirmadoEm" TIMESTAMP(3),
    "anuladoEm" TIMESTAMP(3),
    "anuladoPorId" UUID,
    "motivoAnulacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlocacaoPagamento" (
    "id" UUID NOT NULL,
    "pagamentoId" UUID NOT NULL,
    "encargoId" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlocacaoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estorno" (
    "id" UUID NOT NULL,
    "pagamentoId" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "valorCredito" BIGINT NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoEstorno" NOT NULL DEFAULT 'PROPOSTO',
    "propostoPorId" UUID NOT NULL,
    "propostoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decididoPorId" UUID,
    "decididoEm" TIMESTAMP(3),
    "motivoDecisao" TEXT,

    CONSTRAINT "Estorno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstornoAlocacao" (
    "id" UUID NOT NULL,
    "estornoId" UUID NOT NULL,
    "pagamentoId" UUID NOT NULL,
    "alocacaoId" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstornoAlocacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerieRecibo" (
    "serie" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "proximo" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SerieRecibo_pkey" PRIMARY KEY ("serie","ano")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" UUID NOT NULL,
    "serie" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "pagamentoId" UUID NOT NULL,
    "estudanteId" UUID NOT NULL,
    "valor" BIGINT NOT NULL,
    "emitidoPorId" UUID NOT NULL,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoEncargo_nome_key" ON "TipoEncargo"("nome");

-- CreateIndex
CREATE INDEX "Encargo_estudanteId_vencimento_idx" ON "Encargo"("estudanteId", "vencimento");

-- CreateIndex
CREATE INDEX "Encargo_anoLectivoId_idx" ON "Encargo"("anoLectivoId");

-- CreateIndex
CREATE INDEX "Encargo_tipoEncargoId_idx" ON "Encargo"("tipoEncargoId");

-- CreateIndex
CREATE UNIQUE INDEX "Encargo_estudanteId_tipoEncargoId_referencia_key" ON "Encargo"("estudanteId", "tipoEncargoId", "referencia");

-- CreateIndex
CREATE UNIQUE INDEX "Encargo_id_estudanteId_key" ON "Encargo"("id", "estudanteId");

-- CreateIndex
CREATE INDEX "Pagamento_estudanteId_idx" ON "Pagamento"("estudanteId");

-- CreateIndex
CREATE INDEX "Pagamento_estado_dataPagamento_idx" ON "Pagamento"("estado", "dataPagamento");

-- CreateIndex
CREATE UNIQUE INDEX "Pagamento_id_estudanteId_key" ON "Pagamento"("id", "estudanteId");

-- CreateIndex
CREATE INDEX "AlocacaoPagamento_pagamentoId_idx" ON "AlocacaoPagamento"("pagamentoId");

-- CreateIndex
CREATE INDEX "AlocacaoPagamento_encargoId_idx" ON "AlocacaoPagamento"("encargoId");

-- CreateIndex
CREATE UNIQUE INDEX "AlocacaoPagamento_id_pagamentoId_key" ON "AlocacaoPagamento"("id", "pagamentoId");

-- CreateIndex
CREATE INDEX "Estorno_pagamentoId_idx" ON "Estorno"("pagamentoId");

-- CreateIndex
CREATE INDEX "Estorno_estado_idx" ON "Estorno"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Estorno_id_pagamentoId_key" ON "Estorno"("id", "pagamentoId");

-- CreateIndex
CREATE INDEX "EstornoAlocacao_estornoId_idx" ON "EstornoAlocacao"("estornoId");

-- CreateIndex
CREATE INDEX "EstornoAlocacao_alocacaoId_idx" ON "EstornoAlocacao"("alocacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_pagamentoId_key" ON "Recibo"("pagamentoId");

-- CreateIndex
CREATE INDEX "Recibo_estudanteId_idx" ON "Recibo"("estudanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_serie_ano_numero_key" ON "Recibo"("serie", "ano", "numero");

-- AddForeignKey
ALTER TABLE "Encargo" ADD CONSTRAINT "Encargo_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encargo" ADD CONSTRAINT "Encargo_tipoEncargoId_fkey" FOREIGN KEY ("tipoEncargoId") REFERENCES "TipoEncargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encargo" ADD CONSTRAINT "Encargo_anoLectivoId_fkey" FOREIGN KEY ("anoLectivoId") REFERENCES "AnoLectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_estudanteId_fkey" FOREIGN KEY ("estudanteId") REFERENCES "Estudante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoPagamento" ADD CONSTRAINT "AlocacaoPagamento_pagamentoId_estudanteId_fkey" FOREIGN KEY ("pagamentoId", "estudanteId") REFERENCES "Pagamento"("id", "estudanteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlocacaoPagamento" ADD CONSTRAINT "AlocacaoPagamento_encargoId_estudanteId_fkey" FOREIGN KEY ("encargoId", "estudanteId") REFERENCES "Encargo"("id", "estudanteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstornoAlocacao" ADD CONSTRAINT "EstornoAlocacao_estornoId_pagamentoId_fkey" FOREIGN KEY ("estornoId", "pagamentoId") REFERENCES "Estorno"("id", "pagamentoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstornoAlocacao" ADD CONSTRAINT "EstornoAlocacao_alocacaoId_pagamentoId_fkey" FOREIGN KEY ("alocacaoId", "pagamentoId") REFERENCES "AlocacaoPagamento"("id", "pagamentoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "Pagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GARANTIAS DE INTEGRIDADE FINANCEIRA NA BASE DE DADOS (livro de movimentos imutável)
-- Modelo de confiança (ver ADR-0003 e ADR-0004): o DONO das tabelas é de confiança; a aplicação corre com `lamanus_app`
-- e só chega a CONFIRMADO / ESTORNADO / alocações / recibos através das funções abaixo, que AUTENTICAM o autor pela sessão.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- 1) Restrições simples -----------------------------------------------------------------------
ALTER TABLE "TipoEncargo" ADD CONSTRAINT "TipoEncargo_valor_ck" CHECK ("valorReferencia" >= 0 AND "valorReferencia" <= 1000000000000);
ALTER TABLE "Encargo" ADD CONSTRAINT "Encargo_valor_ck" CHECK ("valor" >= 0 AND "valor" <= 1000000000000);
ALTER TABLE "Encargo" ADD CONSTRAINT "Encargo_anulacao_ck" CHECK (
  ("anuladoEm" IS NULL AND "anuladoPorId" IS NULL AND "motivoAnulacao" IS NULL)
  OR ("anuladoEm" IS NOT NULL AND "anuladoPorId" IS NOT NULL AND length(btrim(coalesce("motivoAnulacao", ''))) >= 5));
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_valor_ck" CHECK ("valor" > 0 AND "valor" <= 1000000000000);
-- Controlo duplo: quem confirma nunca é quem registou.
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_controlo_duplo_ck" CHECK ("confirmadoPorId" IS NULL OR "confirmadoPorId" <> "registadoPorId");
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_estado_ck" CHECK (
  ("estado" = 'REGISTADO' AND "confirmadoEm" IS NULL AND "confirmadoPorId" IS NULL AND "anuladoEm" IS NULL)
  OR ("estado" IN ('CONFIRMADO', 'ESTORNADO') AND "confirmadoEm" IS NOT NULL AND "confirmadoPorId" IS NOT NULL AND "anuladoEm" IS NULL)
  OR ("estado" = 'ANULADO' AND "anuladoEm" IS NOT NULL AND "anuladoPorId" IS NOT NULL AND length(btrim(coalesce("motivoAnulacao", ''))) >= 5 AND "confirmadoEm" IS NULL));
ALTER TABLE "AlocacaoPagamento" ADD CONSTRAINT "Alocacao_valor_ck" CHECK ("valor" > 0);
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_valor_ck" CHECK ("valor" > 0 AND "valorCredito" >= 0 AND "valorCredito" <= "valor");
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_aprovacao_ck" CHECK ("decididoPorId" IS NULL OR "decididoPorId" <> "propostoPorId");
ALTER TABLE "Estorno" ADD CONSTRAINT "Estorno_estado_ck" CHECK (
  ("estado" = 'PROPOSTO' AND "decididoEm" IS NULL AND "decididoPorId" IS NULL)
  OR ("estado" IN ('APROVADO', 'REJEITADO') AND "decididoEm" IS NOT NULL AND "decididoPorId" IS NOT NULL));
ALTER TABLE "EstornoAlocacao" ADD CONSTRAINT "EstornoAlocacao_valor_ck" CHECK ("valor" > 0);
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_valor_ck" CHECK ("valor" > 0 AND "numero" > 0);

-- 2) Funções de cálculo (só leitura) ---------------------------------------------------------
CREATE OR REPLACE FUNCTION pagamento_alocado_liquido(p uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT SUM(valor) FROM "AlocacaoPagamento" WHERE "pagamentoId" = p), 0)
       - COALESCE((SELECT SUM(valor) FROM "EstornoAlocacao" WHERE "pagamentoId" = p), 0)
$$;
CREATE OR REPLACE FUNCTION pagamento_estornado_aprovado(p uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT SUM(valor) FROM "Estorno" WHERE "pagamentoId" = p AND estado = 'APROVADO'), 0)
$$;
CREATE OR REPLACE FUNCTION encargo_pago_liquido(e uuid) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT SUM(valor) FROM "AlocacaoPagamento" WHERE "encargoId" = e), 0)
       - COALESCE((SELECT SUM(ea.valor) FROM "EstornoAlocacao" ea JOIN "AlocacaoPagamento" al ON al.id = ea."alocacaoId" WHERE al."encargoId" = e), 0)
$$;

-- Vista dos encargos com o valor já pago (líquido de estornos). O estado (pendente/parcial/pago/vencido) calcula-se a partir daqui.
CREATE OR REPLACE VIEW "VistaEncargo" AS
SELECT e.id, e."estudanteId", e."tipoEncargoId", e."anoLectivoId", e.referencia, e.descricao, e.valor, e.vencimento, e."anuladoEm",
       (COALESCE(a.v, 0) - COALESCE(r.v, 0))::bigint AS pago
  FROM "Encargo" e
  LEFT JOIN (SELECT "encargoId", SUM(valor) AS v FROM "AlocacaoPagamento" GROUP BY "encargoId") a ON a."encargoId" = e.id
  LEFT JOIN (SELECT al."encargoId", SUM(ea.valor) AS v FROM "EstornoAlocacao" ea JOIN "AlocacaoPagamento" al ON al.id = ea."alocacaoId" GROUP BY al."encargoId") r ON r."encargoId" = e.id;

-- 3) Autenticação e autorização do autor, FEITAS PELA BASE DE DADOS (mesmo mecanismo da correcção de notas) -----------
--    Só é chamada de dentro de outras funções SECURITY DEFINER; a aplicação não a pode invocar (seria um oráculo de sessões).
CREATE OR REPLACE FUNCTION autenticar_e_autorizar(p_token_sessao text, p_permissao text)
RETURNS TABLE (user_id uuid, sessao_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user uuid;
  v_sessao uuid;
BEGIN
  IF p_token_sessao IS NULL OR length(p_token_sessao) < 20 THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  SELECT s.id, s."userId" INTO v_sessao, v_user
    FROM "Session" s JOIN "User" u ON u.id = s."userId"
   WHERE s."tokenHash" = encode(sha256(convert_to(p_token_sessao, 'UTF8')), 'hex')
     AND s."revogadaEm" IS NULL AND s."expiraEm" > now()
     AND s."ultimaActividade" > now() - interval '30 minutes'
     AND u.estado = 'ACTIVO';
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "UserRole" ur JOIN "RolePermission" rp ON rp."roleId" = ur."roleId" JOIN "Permission" p ON p.id = rp."permissionId"
     WHERE ur."userId" = v_user AND p.codigo = p_permissao
  ) THEN RAISE EXCEPTION 'Sem permissão (%)', p_permissao; END IF;
  RETURN QUERY SELECT v_user, v_sessao;
END;
$$;
REVOKE ALL ON FUNCTION autenticar_e_autorizar(text, text) FROM PUBLIC;

-- 4) Gatilhos: o livro de movimentos é imutável --------------------------------------------------
-- 4.1 Encargo: o valor e a identidade nunca mudam; só se pode ANULAR (sem pagamentos líquidos), uma vez.
CREATE OR REPLACE FUNCTION encargo_guarda() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Encargos não se apagam (anule-os com motivo)'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."anuladoEm" IS NOT NULL THEN RAISE EXCEPTION 'Um encargo nasce activo'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."estudanteId" <> OLD."estudanteId" OR NEW."tipoEncargoId" <> OLD."tipoEncargoId" OR NEW."anoLectivoId" <> OLD."anoLectivoId"
     OR NEW.referencia <> OLD.referencia OR NEW.descricao <> OLD.descricao OR NEW.valor <> OLD.valor OR NEW.vencimento <> OLD.vencimento THEN
    RAISE EXCEPTION 'O valor e os dados de um encargo não se alteram (anule-o e crie outro)';
  END IF;
  IF OLD."anuladoEm" IS NOT NULL THEN RAISE EXCEPTION 'Um encargo anulado é definitivo'; END IF;
  IF NEW."anuladoEm" IS NOT NULL AND encargo_pago_liquido(OLD.id) <> 0 THEN
    RAISE EXCEPTION 'Não se anula um encargo com pagamentos alocados (estorne primeiro)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER encargo_guarda BEFORE INSERT OR UPDATE OR DELETE ON "Encargo" FOR EACH ROW EXECUTE FUNCTION encargo_guarda();

-- 4.2 Pagamento: nasce REGISTADO; o valor e os dados nunca mudam; CONFIRMADO/ESTORNADO só pelo procedimento autorizado.
CREATE OR REPLACE FUNCTION pagamento_guarda() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Pagamentos não se apagam (corrija por estorno)'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Os pagamentos só se registam pelo procedimento autorizado'; END IF;
    IF NEW.estado <> 'REGISTADO' OR NEW."confirmadoPorId" IS NOT NULL OR NEW."confirmadoEm" IS NOT NULL OR NEW."anuladoEm" IS NOT NULL THEN
      RAISE EXCEPTION 'Um pagamento nasce sempre REGISTADO';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.valor <> OLD.valor OR NEW."estudanteId" <> OLD."estudanteId" OR NEW.metodo <> OLD.metodo
     OR NEW."referenciaExterna" IS DISTINCT FROM OLD."referenciaExterna" OR NEW."nomePagador" IS DISTINCT FROM OLD."nomePagador"
     OR NEW."dataPagamento" <> OLD."dataPagamento" OR NEW."modoAlocacao" <> OLD."modoAlocacao"
     OR NEW."registadoPorId" <> OLD."registadoPorId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'O valor e os dados de um pagamento não se alteram (corrija por estorno)';
  END IF;
  IF OLD.estado IN ('ESTORNADO', 'ANULADO') THEN RAISE EXCEPTION 'Um pagamento % é definitivo', OLD.estado; END IF;
  IF NEW.estado = OLD.estado THEN
    IF NEW."confirmadoPorId" IS DISTINCT FROM OLD."confirmadoPorId" OR NEW."confirmadoEm" IS DISTINCT FROM OLD."confirmadoEm"
       OR NEW."anuladoEm" IS DISTINCT FROM OLD."anuladoEm" OR NEW."anuladoPorId" IS DISTINCT FROM OLD."anuladoPorId"
       OR NEW."motivoAnulacao" IS DISTINCT FROM OLD."motivoAnulacao" THEN
      RAISE EXCEPTION 'Sem alterações permitidas neste pagamento';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.estado = 'REGISTADO' AND NEW.estado = 'ANULADO' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'A anulação de pagamentos só se faz pelo procedimento autorizado'; END IF;
    RETURN NEW; -- anular um registo ainda sem efeito nas contas (com motivo; ver CHECK)
  ELSIF (OLD.estado = 'REGISTADO' AND NEW.estado = 'CONFIRMADO') OR (OLD.estado = 'CONFIRMADO' AND NEW.estado = 'ESTORNADO') THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'O estado % só se atinge pelo procedimento autorizado', NEW.estado; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Transição de pagamento inválida: % → %', OLD.estado, NEW.estado;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pagamento_guarda BEFORE INSERT OR UPDATE OR DELETE ON "Pagamento" FOR EACH ROW EXECUTE FUNCTION pagamento_guarda();

-- 4.3 Alocações: só pelas funções autorizadas; nunca excedem o pagamento nem o encargo (linhas bloqueadas); imutáveis.
CREATE OR REPLACE FUNCTION alocacao_guarda() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoPagamento";
  v_valor_pag bigint;
  v_valor_enc bigint;
  v_anulado timestamp;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Uma alocação não se altera (estorne-a)'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Uma alocação não se apaga (estorne-a)'; END IF;
    RETURN OLD;
  END IF;
  IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'As alocações só se criam pelo procedimento autorizado'; END IF;
  SELECT estado, valor INTO v_estado, v_valor_pag FROM "Pagamento" WHERE id = NEW."pagamentoId" FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'CONFIRMADO' THEN RAISE EXCEPTION 'Só se aloca um pagamento confirmado'; END IF;
  IF pagamento_alocado_liquido(NEW."pagamentoId") + NEW.valor > v_valor_pag - pagamento_estornado_aprovado(NEW."pagamentoId") THEN
    RAISE EXCEPTION 'A alocação excede o valor disponível do pagamento';
  END IF;
  SELECT valor, "anuladoEm" INTO v_valor_enc, v_anulado FROM "Encargo" WHERE id = NEW."encargoId" FOR UPDATE;
  IF v_anulado IS NOT NULL THEN RAISE EXCEPTION 'O encargo está anulado'; END IF;
  IF encargo_pago_liquido(NEW."encargoId") + NEW.valor > v_valor_enc THEN
    RAISE EXCEPTION 'A alocação excede o valor em dívida do encargo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER alocacao_guarda BEFORE INSERT OR UPDATE OR DELETE ON "AlocacaoPagamento" FOR EACH ROW EXECUTE FUNCTION alocacao_guarda();

-- 4.4 Estorno: a aplicação só propõe (PROPOSTO) ou rejeita; APROVADO só pelo procedimento autorizado.
CREATE OR REPLACE FUNCTION estorno_guarda() RETURNS trigger AS $$
DECLARE
  v_estado "EstadoPagamento";
  v_valor_pag bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Estornos não se apagam'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Os estornos só se propõem pelo procedimento autorizado'; END IF;
    IF NEW.estado <> 'PROPOSTO' OR NEW."valorCredito" <> 0 OR NEW."decididoPorId" IS NOT NULL THEN RAISE EXCEPTION 'Um estorno nasce PROPOSTO'; END IF;
    SELECT estado, valor INTO v_estado, v_valor_pag FROM "Pagamento" WHERE id = NEW."pagamentoId";
    IF v_estado IS DISTINCT FROM 'CONFIRMADO' THEN RAISE EXCEPTION 'Só se estorna um pagamento confirmado'; END IF;
    IF NEW.valor > v_valor_pag - pagamento_estornado_aprovado(NEW."pagamentoId") THEN
      RAISE EXCEPTION 'O estorno excede o valor ainda não estornado do pagamento';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."pagamentoId" <> OLD."pagamentoId" OR NEW.valor <> OLD.valor OR NEW.motivo <> OLD.motivo
     OR NEW."propostoPorId" <> OLD."propostoPorId" OR NEW."propostoEm" <> OLD."propostoEm" THEN
    RAISE EXCEPTION 'O valor e o motivo de um estorno não se alteram';
  END IF;
  IF OLD.estado <> 'PROPOSTO' THEN RAISE EXCEPTION 'Um estorno % é definitivo', OLD.estado; END IF;
  IF NEW.estado = 'REJEITADO' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'A rejeição de estornos só se faz pelo procedimento autorizado'; END IF;
    IF NEW."valorCredito" <> 0 THEN RAISE EXCEPTION 'Um estorno rejeitado não tem valor revertido'; END IF;
    RETURN NEW;
  ELSIF NEW.estado = 'APROVADO' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'A aprovação de estornos só se faz pelo procedimento autorizado'; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Transição de estorno inválida';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER estorno_guarda BEFORE INSERT OR UPDATE OR DELETE ON "Estorno" FOR EACH ROW EXECUTE FUNCTION estorno_guarda();

-- 4.5 Movimento inverso de uma alocação: só pelo procedimento autorizado; nunca excede a alocação nem o estorno.
CREATE OR REPLACE FUNCTION estorno_alocacao_guarda() RETURNS trigger AS $$
DECLARE
  v_aloc bigint;
  v_estado "EstadoEstorno";
  v_valor_est bigint;
  v_credito bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Um movimento inverso não se altera'; END IF;
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Um movimento inverso não se apaga'; END IF;
    RETURN OLD;
  END IF;
  IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Os movimentos inversos só se criam pelo procedimento autorizado'; END IF;
  SELECT valor INTO v_aloc FROM "AlocacaoPagamento" WHERE id = NEW."alocacaoId" FOR UPDATE;
  IF COALESCE((SELECT SUM(valor) FROM "EstornoAlocacao" WHERE "alocacaoId" = NEW."alocacaoId"), 0) + NEW.valor > v_aloc THEN
    RAISE EXCEPTION 'O movimento inverso excede a alocação';
  END IF;
  SELECT estado, valor, "valorCredito" INTO v_estado, v_valor_est, v_credito FROM "Estorno" WHERE id = NEW."estornoId" FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'APROVADO' THEN RAISE EXCEPTION 'Só um estorno aprovado reverte alocações'; END IF;
  IF COALESCE((SELECT SUM(valor) FROM "EstornoAlocacao" WHERE "estornoId" = NEW."estornoId"), 0) + NEW.valor > v_valor_est - v_credito THEN
    RAISE EXCEPTION 'O movimento inverso excede o valor do estorno';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER estorno_alocacao_guarda BEFORE INSERT OR UPDATE OR DELETE ON "EstornoAlocacao" FOR EACH ROW EXECUTE FUNCTION estorno_alocacao_guarda();

-- 4.6 Recibo: só o procedimento autorizado o emite; nunca se altera nem apaga.
CREATE OR REPLACE FUNCTION recibo_guarda() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Um recibo não se altera'; END IF;
  IF NOT e_dono_das_tabelas() THEN RAISE EXCEPTION 'Os recibos só se emitem pelo procedimento autorizado e não se apagam'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER recibo_guarda BEFORE INSERT OR UPDATE OR DELETE ON "Recibo" FOR EACH ROW EXECUTE FUNCTION recibo_guarda();

-- 4.7 TRUNCATE não dispara gatilhos de linha.
CREATE TRIGGER encargo_sem_truncate BEFORE TRUNCATE ON "Encargo" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER pagamento_sem_truncate BEFORE TRUNCATE ON "Pagamento" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER alocacao_sem_truncate BEFORE TRUNCATE ON "AlocacaoPagamento" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER estorno_sem_truncate BEFORE TRUNCATE ON "Estorno" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER estorno_alocacao_sem_truncate BEFORE TRUNCATE ON "EstornoAlocacao" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER recibo_sem_truncate BEFORE TRUNCATE ON "Recibo" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER serie_recibo_sem_truncate BEFORE TRUNCATE ON "SerieRecibo" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();


-- 5) Procedimentos autorizados (SECURITY DEFINER) -----------------------------------------------
--    Todos autenticam o AUTOR pelo token da sessão (não existe argumento "autor"), verificam a permissão, fazem a mudança e a auditoria
--    na MESMA transacção. A aplicação (`lamanus_app`) não tem INSERT/UPDATE/DELETE directo nestas tabelas (ver prisma/grants.sql);
--    os gatilhos acima repetem a regra para quem tenha privilégios por engano.

CREATE OR REPLACE FUNCTION auditar_financeiro(p_actor uuid, p_sessao uuid, p_acao text, p_entidade text, p_id uuid, p_antes jsonb, p_depois jsonb, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO "EventoAuditoria" (id, "actorId", acao, entidade, "entidadeId", antes, depois, ip, em)
  VALUES (gen_random_uuid(), p_actor, p_acao, p_entidade, p_id::text, p_antes, COALESCE(p_depois, '{}'::jsonb) || jsonb_build_object('sessaoId', p_sessao), p_ip, now());
END;
$$;
REVOKE ALL ON FUNCTION auditar_financeiro(uuid, uuid, text, text, uuid, jsonb, jsonb, text) FROM PUBLIC;

-- 5.1 Registar um pagamento (fica REGISTADO: ainda sem efeito nas contas) -----------------------------
CREATE OR REPLACE FUNCTION registar_pagamento(p_estudante uuid, p_valor bigint, p_metodo "MetodoPagamento", p_data date, p_modo "ModoAlocacao",
                                              p_referencia text, p_pagador text, p_token_sessao text, p_ip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_id uuid := gen_random_uuid();
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'financeiro:editar') a;
  IF p_valor IS NULL OR p_valor <= 0 OR p_valor > 1000000000000 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF p_data IS NULL OR p_data > (now() AT TIME ZONE 'Africa/Luanda')::date THEN RAISE EXCEPTION 'A data do pagamento não pode ser futura'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Estudante" WHERE id = p_estudante) THEN RAISE EXCEPTION 'Estudante inexistente'; END IF;
  INSERT INTO "Pagamento" (id, "estudanteId", valor, metodo, "referenciaExterna", "nomePagador", "dataPagamento", "modoAlocacao", estado, "registadoPorId")
  VALUES (v_id, p_estudante, p_valor, p_metodo, NULLIF(btrim(p_referencia), ''), NULLIF(btrim(p_pagador), ''), p_data, COALESCE(p_modo, 'AUTOMATICO'), 'REGISTADO', v_actor);
  PERFORM auditar_financeiro(v_actor, v_sessao, 'PAGAMENTO_REGISTADO', 'Pagamento', v_id, NULL,
                             jsonb_build_object('estudanteId', p_estudante, 'valor', p_valor, 'metodo', p_metodo), p_ip);
  RETURN v_id;
END;
$$;

-- 5.2 Anular um registo ainda não confirmado --------------------------------------------------------
CREATE OR REPLACE FUNCTION anular_pagamento(p_pagamento uuid, p_motivo text, p_token_sessao text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_estado "EstadoPagamento"; v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'financeiro:editar') a;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)'; END IF;
  SELECT estado INTO v_estado FROM "Pagamento" WHERE id = p_pagamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento inexistente'; END IF;
  IF v_estado <> 'REGISTADO' THEN RAISE EXCEPTION 'Só se anula um pagamento ainda não confirmado (use o estorno)'; END IF;
  UPDATE "Pagamento" SET estado = 'ANULADO', "anuladoEm" = now(), "anuladoPorId" = v_actor, "motivoAnulacao" = v_motivo WHERE id = p_pagamento;
  PERFORM auditar_financeiro(v_actor, v_sessao, 'PAGAMENTO_ANULADO', 'Pagamento', p_pagamento, jsonb_build_object('estado', 'REGISTADO'), jsonb_build_object('motivo', v_motivo), p_ip);
END;
$$;

-- 5.3 Confirmar um pagamento: alocação automática + recibo sequencial + auditoria, numa só transacção ---------
CREATE OR REPLACE FUNCTION confirmar_pagamento(p_pagamento uuid, p_token_sessao text, p_ip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid;
  v_pag "Pagamento"%ROWTYPE;
  v_restante bigint; v_dev bigint; v_aloc bigint;
  v_enc record;
  v_ano integer := EXTRACT(year FROM (now() AT TIME ZONE 'Africa/Luanda'))::integer;
  v_numero integer; v_recibo uuid := gen_random_uuid();
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'pagamento:confirmar') a;
  SELECT * INTO v_pag FROM "Pagamento" WHERE id = p_pagamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento inexistente'; END IF;
  IF v_pag.estado <> 'REGISTADO' THEN RAISE EXCEPTION 'O pagamento já não está por confirmar (estado %)', v_pag.estado; END IF;
  IF v_pag."registadoPorId" = v_actor THEN RAISE EXCEPTION 'Quem registou o pagamento não o pode confirmar'; END IF;

  UPDATE "Pagamento" SET estado = 'CONFIRMADO', "confirmadoEm" = now(), "confirmadoPorId" = v_actor WHERE id = p_pagamento;

  -- Alocação automática ao encargo mais antigo (vencimento, criação, id) com valor em dívida.
  IF v_pag."modoAlocacao" = 'AUTOMATICO' THEN
    v_restante := v_pag.valor;
    FOR v_enc IN
      SELECT id, valor FROM "Encargo" WHERE "estudanteId" = v_pag."estudanteId" AND "anuladoEm" IS NULL
       ORDER BY vencimento, "createdAt", id FOR UPDATE
    LOOP
      EXIT WHEN v_restante <= 0;
      v_dev := v_enc.valor - encargo_pago_liquido(v_enc.id);
      IF v_dev > 0 THEN
        v_aloc := LEAST(v_restante, v_dev);
        INSERT INTO "AlocacaoPagamento" (id, "pagamentoId", "encargoId", "estudanteId", valor) VALUES (gen_random_uuid(), p_pagamento, v_enc.id, v_pag."estudanteId", v_aloc);
        v_restante := v_restante - v_aloc;
      END IF;
    END LOOP;
  END IF;

  -- Número de recibo sem saltos: a linha do contador fica bloqueada até ao fim desta transacção; se ela falhar, o número volta atrás.
  INSERT INTO "SerieRecibo" (serie, ano, proximo) VALUES ('R', v_ano, 1) ON CONFLICT (serie, ano) DO NOTHING;
  SELECT proximo INTO v_numero FROM "SerieRecibo" WHERE serie = 'R' AND ano = v_ano FOR UPDATE;
  UPDATE "SerieRecibo" SET proximo = v_numero + 1 WHERE serie = 'R' AND ano = v_ano;
  INSERT INTO "Recibo" (id, serie, ano, numero, "pagamentoId", "estudanteId", valor, "emitidoPorId")
  VALUES (v_recibo, 'R', v_ano, v_numero, p_pagamento, v_pag."estudanteId", v_pag.valor, v_actor);

  PERFORM auditar_financeiro(v_actor, v_sessao, 'PAGAMENTO_CONFIRMADO', 'Pagamento', p_pagamento, jsonb_build_object('estado', 'REGISTADO'),
                             jsonb_build_object('valor', v_pag.valor, 'recibo', 'R/' || v_ano || '/' || v_numero, 'estudanteId', v_pag."estudanteId"), p_ip);
  RETURN v_recibo;
END;
$$;

-- 5.4 Alocação manual de (parte do) valor ainda por alocar de um pagamento confirmado -------------------
CREATE OR REPLACE FUNCTION alocar_pagamento_manual(p_pagamento uuid, p_encargo uuid, p_valor bigint, p_token_sessao text, p_ip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_pag "Pagamento"%ROWTYPE; v_est uuid; v_id uuid := gen_random_uuid();
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'financeiro:editar') a;
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT * INTO v_pag FROM "Pagamento" WHERE id = p_pagamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento inexistente'; END IF;
  SELECT "estudanteId" INTO v_est FROM "Encargo" WHERE id = p_encargo;
  IF v_est IS DISTINCT FROM v_pag."estudanteId" THEN RAISE EXCEPTION 'O encargo não pertence ao estudante do pagamento'; END IF;
  -- os gatilhos validam estado CONFIRMADO, saldo do pagamento e do encargo
  INSERT INTO "AlocacaoPagamento" (id, "pagamentoId", "encargoId", "estudanteId", valor) VALUES (v_id, p_pagamento, p_encargo, v_est, p_valor);
  PERFORM auditar_financeiro(v_actor, v_sessao, 'PAGAMENTO_ALOCADO', 'AlocacaoPagamento', v_id, NULL,
                             jsonb_build_object('pagamentoId', p_pagamento, 'encargoId', p_encargo, 'valor', p_valor), p_ip);
  RETURN v_id;
END;
$$;

-- 5.5 Estornos: propor (Financeiro), rejeitar/aprovar (Direcção, pessoa diferente) ----------------------
CREATE OR REPLACE FUNCTION propor_estorno(p_pagamento uuid, p_valor bigint, p_motivo text, p_token_sessao text, p_ip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_id uuid := gen_random_uuid(); v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'estorno:propor') a;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)'; END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  PERFORM 1 FROM "Pagamento" WHERE id = p_pagamento FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pagamento inexistente'; END IF;
  INSERT INTO "Estorno" (id, "pagamentoId", valor, "valorCredito", motivo, estado, "propostoPorId") VALUES (v_id, p_pagamento, p_valor, 0, v_motivo, 'PROPOSTO', v_actor);
  PERFORM auditar_financeiro(v_actor, v_sessao, 'ESTORNO_PROPOSTO', 'Estorno', v_id, NULL, jsonb_build_object('pagamentoId', p_pagamento, 'valor', p_valor, 'motivo', v_motivo), p_ip);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rejeitar_estorno(p_estorno uuid, p_motivo text, p_token_sessao text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_est "Estorno"%ROWTYPE; v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'estorno:aprovar') a;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)'; END IF;
  SELECT * INTO v_est FROM "Estorno" WHERE id = p_estorno FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estorno inexistente'; END IF;
  IF v_est.estado <> 'PROPOSTO' THEN RAISE EXCEPTION 'O estorno já foi decidido'; END IF;
  IF v_est."propostoPorId" = v_actor THEN RAISE EXCEPTION 'Quem propôs o estorno não o pode decidir'; END IF;
  UPDATE "Estorno" SET estado = 'REJEITADO', "decididoPorId" = v_actor, "decididoEm" = now(), "motivoDecisao" = v_motivo WHERE id = p_estorno;
  PERFORM auditar_financeiro(v_actor, v_sessao, 'ESTORNO_REJEITADO', 'Estorno', p_estorno, jsonb_build_object('estado', 'PROPOSTO'), jsonb_build_object('motivo', v_motivo), p_ip);
END;
$$;

-- Aprovar: reverte primeiro o crédito (valor ainda não alocado) e depois as alocações, da mais recente para a mais antiga.
CREATE OR REPLACE FUNCTION aprovar_estorno(p_estorno uuid, p_motivo text, p_token_sessao text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_est "Estorno"%ROWTYPE; v_pag "Pagamento"%ROWTYPE;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_livre bigint; v_credito bigint; v_resta bigint; v_disp bigint; v_tira bigint; v_al record;
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'estorno:aprovar') a;
  SELECT * INTO v_est FROM "Estorno" WHERE id = p_estorno FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estorno inexistente'; END IF;
  IF v_est.estado <> 'PROPOSTO' THEN RAISE EXCEPTION 'O estorno já foi decidido'; END IF;
  IF v_est."propostoPorId" = v_actor THEN RAISE EXCEPTION 'Quem propôs o estorno não o pode aprovar'; END IF;
  SELECT * INTO v_pag FROM "Pagamento" WHERE id = v_est."pagamentoId" FOR UPDATE;
  IF v_pag.estado <> 'CONFIRMADO' THEN RAISE EXCEPTION 'Só se estorna um pagamento confirmado'; END IF;
  IF v_est.valor > v_pag.valor - pagamento_estornado_aprovado(v_pag.id) THEN RAISE EXCEPTION 'O estorno excede o valor ainda não estornado do pagamento'; END IF;

  v_livre := (v_pag.valor - pagamento_estornado_aprovado(v_pag.id)) - pagamento_alocado_liquido(v_pag.id);
  v_credito := LEAST(v_est.valor, GREATEST(v_livre, 0));
  v_resta := v_est.valor - v_credito;

  -- primeiro o estorno passa a APROVADO (com o crédito revertido); depois registam-se os movimentos inversos
  UPDATE "Estorno" SET estado = 'APROVADO', "valorCredito" = v_credito, "decididoPorId" = v_actor, "decididoEm" = now(), "motivoDecisao" = NULLIF(v_motivo, '') WHERE id = p_estorno;

  FOR v_al IN SELECT id, valor FROM "AlocacaoPagamento" WHERE "pagamentoId" = v_pag.id ORDER BY "createdAt" DESC, id DESC FOR UPDATE LOOP
    EXIT WHEN v_resta <= 0;
    v_disp := v_al.valor - COALESCE((SELECT SUM(valor) FROM "EstornoAlocacao" WHERE "alocacaoId" = v_al.id), 0);
    IF v_disp > 0 THEN
      v_tira := LEAST(v_disp, v_resta);
      INSERT INTO "EstornoAlocacao" (id, "estornoId", "pagamentoId", "alocacaoId", valor) VALUES (gen_random_uuid(), p_estorno, v_pag.id, v_al.id, v_tira);
      v_resta := v_resta - v_tira;
    END IF;
  END LOOP;
  IF v_resta <> 0 THEN RAISE EXCEPTION 'Inconsistência: não foi possível reverter todo o valor do estorno'; END IF;

  IF pagamento_estornado_aprovado(v_pag.id) = v_pag.valor THEN
    UPDATE "Pagamento" SET estado = 'ESTORNADO' WHERE id = v_pag.id;
  END IF;
  PERFORM auditar_financeiro(v_actor, v_sessao, 'ESTORNO_APROVADO', 'Estorno', p_estorno, jsonb_build_object('estado', 'PROPOSTO'),
                             jsonb_build_object('pagamentoId', v_pag.id, 'valor', v_est.valor, 'credito', v_credito, 'propostoPor', v_est."propostoPorId"), p_ip);
END;
$$;

REVOKE ALL ON FUNCTION registar_pagamento(uuid, bigint, "MetodoPagamento", date, "ModoAlocacao", text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION anular_pagamento(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirmar_pagamento(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION alocar_pagamento_manual(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION propor_estorno(uuid, bigint, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION rejeitar_estorno(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION aprovar_estorno(uuid, text, text, text) FROM PUBLIC;

-- 6) Reconciliação: devolve as violações dos invariantes monetários (vazio = tudo certo) --------------------
CREATE OR REPLACE FUNCTION reconciliacao_financeira(p_estudantes uuid[] DEFAULT NULL)
RETURNS TABLE (verificacao text, entidade_id text, detalhe text) LANGUAGE sql STABLE AS $$
  SELECT 'pagamento_sobre_alocado', p.id::text, 'alocado líquido ' || pagamento_alocado_liquido(p.id) || ' > disponível ' || (p.valor - pagamento_estornado_aprovado(p.id))
    FROM "Pagamento" p WHERE (p_estudantes IS NULL OR p."estudanteId" = ANY (p_estudantes))
     AND (pagamento_alocado_liquido(p.id) > p.valor - pagamento_estornado_aprovado(p.id) OR pagamento_alocado_liquido(p.id) < 0)
  UNION ALL
  SELECT 'pagamento_alocado_sem_confirmacao', p.id::text, 'estado ' || p.estado
    FROM "Pagamento" p WHERE (p_estudantes IS NULL OR p."estudanteId" = ANY (p_estudantes))
     AND p.estado IN ('REGISTADO', 'ANULADO') AND EXISTS (SELECT 1 FROM "AlocacaoPagamento" a WHERE a."pagamentoId" = p.id)
  UNION ALL
  SELECT 'encargo_sobre_pago', e.id::text, 'pago líquido ' || encargo_pago_liquido(e.id) || ' > valor ' || e.valor
    FROM "Encargo" e WHERE (p_estudantes IS NULL OR e."estudanteId" = ANY (p_estudantes))
     AND (encargo_pago_liquido(e.id) > e.valor OR encargo_pago_liquido(e.id) < 0)
  UNION ALL
  SELECT 'pagamento_confirmado_sem_recibo', p.id::text, 'estado ' || p.estado
    FROM "Pagamento" p WHERE (p_estudantes IS NULL OR p."estudanteId" = ANY (p_estudantes))
     AND p.estado IN ('CONFIRMADO', 'ESTORNADO') AND NOT EXISTS (SELECT 1 FROM "Recibo" r WHERE r."pagamentoId" = p.id)
  UNION ALL
  SELECT 'recibo_indevido_ou_valor_diferente', r.id::text, 'recibo ' || r.serie || '/' || r.ano || '/' || r.numero
    FROM "Recibo" r JOIN "Pagamento" p ON p.id = r."pagamentoId"
   WHERE (p_estudantes IS NULL OR r."estudanteId" = ANY (p_estudantes)) AND (p.estado NOT IN ('CONFIRMADO', 'ESTORNADO') OR p.valor <> r.valor OR p."estudanteId" <> r."estudanteId")
  UNION ALL
  SELECT 'estorno_incompleto', s.id::text, 'valor ' || s.valor || ' ≠ crédito ' || s."valorCredito" || ' + movimentos ' || COALESCE((SELECT SUM(ea.valor) FROM "EstornoAlocacao" ea WHERE ea."estornoId" = s.id), 0)
    FROM "Estorno" s JOIN "Pagamento" p ON p.id = s."pagamentoId"
   WHERE (p_estudantes IS NULL OR p."estudanteId" = ANY (p_estudantes)) AND s.estado = 'APROVADO'
     AND s.valor <> s."valorCredito" + COALESCE((SELECT SUM(ea.valor) FROM "EstornoAlocacao" ea WHERE ea."estornoId" = s.id), 0)
  UNION ALL
  SELECT 'estorno_sem_efeito', s.id::text, 'estado ' || s.estado
    FROM "Estorno" s JOIN "Pagamento" p ON p.id = s."pagamentoId"
   WHERE (p_estudantes IS NULL OR p."estudanteId" = ANY (p_estudantes)) AND s.estado <> 'APROVADO'
     AND (s."valorCredito" <> 0 OR EXISTS (SELECT 1 FROM "EstornoAlocacao" ea WHERE ea."estornoId" = s.id))
  UNION ALL
  SELECT 'estado_pagamento_incoerente', p.id::text, 'estado ' || p.estado || ', estornado ' || pagamento_estornado_aprovado(p.id)
    FROM "Pagamento" p WHERE (p_estudantes IS NULL OR p."estudanteId" = ANY (p_estudantes))
     AND ((p.estado = 'ESTORNADO' AND pagamento_estornado_aprovado(p.id) <> p.valor) OR (p.estado = 'CONFIRMADO' AND pagamento_estornado_aprovado(p.id) >= p.valor))
$$;

-- Numeração global dos recibos: 1..n sem saltos nem repetições e contador coerente.
CREATE OR REPLACE FUNCTION reconciliacao_numeracao()
RETURNS TABLE (verificacao text, entidade_id text, detalhe text) LANGUAGE sql STABLE AS $$
  SELECT 'numeracao_com_saltos', r.serie || '/' || r.ano, 'min ' || min(r.numero) || ', max ' || max(r.numero) || ', total ' || count(*)
    FROM "Recibo" r GROUP BY r.serie, r.ano HAVING min(r.numero) <> 1 OR max(r.numero) <> count(*)
  UNION ALL
  SELECT 'contador_incoerente', s.serie || '/' || s.ano, 'proximo ' || s.proximo || ' ≠ ' || (COALESCE((SELECT max(numero) FROM "Recibo" r WHERE r.serie = s.serie AND r.ano = s.ano), 0) + 1)
    FROM "SerieRecibo" s WHERE s.proximo <> COALESCE((SELECT max(numero) FROM "Recibo" r WHERE r.serie = s.serie AND r.ano = s.ano), 0) + 1
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lamanus_app') THEN
    GRANT EXECUTE ON FUNCTION registar_pagamento(uuid, bigint, "MetodoPagamento", date, "ModoAlocacao", text, text, text, text) TO lamanus_app;
    GRANT EXECUTE ON FUNCTION anular_pagamento(uuid, text, text, text) TO lamanus_app;
    GRANT EXECUTE ON FUNCTION confirmar_pagamento(uuid, text, text) TO lamanus_app;
    GRANT EXECUTE ON FUNCTION alocar_pagamento_manual(uuid, uuid, bigint, text, text) TO lamanus_app;
    GRANT EXECUTE ON FUNCTION propor_estorno(uuid, bigint, text, text, text) TO lamanus_app;
    GRANT EXECUTE ON FUNCTION rejeitar_estorno(uuid, text, text, text) TO lamanus_app;
    GRANT EXECUTE ON FUNCTION aprovar_estorno(uuid, text, text, text) TO lamanus_app;
  END IF;
END $$;
