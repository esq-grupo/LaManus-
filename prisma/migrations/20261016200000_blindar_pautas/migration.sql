-- Blindagem das pautas contra SQL directo (revisão n.º 1 da Entrega D).
--
-- Modelo de confiança: o DONO das tabelas (migrações, seed, administração) é de confiança; a APLICAÇÃO corre com o papel
-- restrito `lamanus_app` (docker/db/papeis.sql + prisma/grants.sql), que não é dono: não pode desligar gatilhos, apagar
-- índices, fazer TRUNCATE nem assumir outro papel. Antes, o contorno era uma variável de sessão (`app.permitir_correcao`)
-- que QUALQUER ligação podia definir — por isso deixa de existir. A correcção de notas publicadas passa a ser uma
-- função privilegiada (SECURITY DEFINER) que valida e audita ela própria.

-- 1) Identidade de quem executa: é o dono das tabelas? (dentro de uma função SECURITY DEFINER, current_user é o dono da função)
CREATE OR REPLACE FUNCTION e_dono_das_tabelas() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_user = pg_get_userbyid((SELECT c.relowner FROM pg_class c WHERE c.oid = 'public."Nota"'::regclass))
$$;

CREATE OR REPLACE FUNCTION estado_da_pauta(p_turma uuid, p_periodo uuid) RETURNS "EstadoPauta" LANGUAGE sql STABLE AS $$
  SELECT p.estado FROM "PautaPublicacao" p WHERE p."turmaId" = p_turma AND p."periodoId" = p_periodo
$$;

-- 2) Notas e avaliações: imutáveis fora do RASCUNHO; chaves imutáveis; verifica a pauta ANTIGA e a NOVA.
CREATE OR REPLACE FUNCTION nota_pauta_bloqueada() RETURNS trigger AS $$
DECLARE
  v_estado_antigo "EstadoPauta";
  v_estado_novo "EstadoPauta";
BEGIN
  IF e_dono_das_tabelas() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Atenção: em PL/pgSQL os campos de NEW/OLD só existem na tabela do gatilho; por isso os IF são ANINHADOS
  -- (uma condição `TG_TABLE_NAME = 'X' AND NEW.campoDeX` falharia em tabelas que não têm esse campo).
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'Nota' THEN
      IF NEW."avaliacaoId" <> OLD."avaliacaoId" OR NEW."estudanteId" <> OLD."estudanteId" THEN
        RAISE EXCEPTION 'A avaliação e o estudante de uma nota são imutáveis';
      END IF;
    ELSE
      IF NEW."turmaDisciplinaId" <> OLD."turmaDisciplinaId" OR NEW."turmaId" <> OLD."turmaId"
         OR NEW."periodoId" <> OLD."periodoId" OR NEW."anoLectivoId" <> OLD."anoLectivoId" THEN
        RAISE EXCEPTION 'A disciplina, a turma e o período de uma avaliação são imutáveis';
      END IF;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'Nota' THEN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
      SELECT estado_da_pauta(a."turmaId", a."periodoId") INTO v_estado_antigo FROM "Avaliacao" a WHERE a.id = OLD."avaliacaoId";
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
      SELECT estado_da_pauta(a."turmaId", a."periodoId") INTO v_estado_novo FROM "Avaliacao" a WHERE a.id = NEW."avaliacaoId";
    END IF;
  ELSE
    IF TG_OP IN ('UPDATE', 'DELETE') THEN v_estado_antigo := estado_da_pauta(OLD."turmaId", OLD."periodoId"); END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN v_estado_novo := estado_da_pauta(NEW."turmaId", NEW."periodoId"); END IF;
  END IF;

  IF (v_estado_antigo IS NOT NULL AND v_estado_antigo <> 'RASCUNHO') OR (v_estado_novo IS NOT NULL AND v_estado_novo <> 'RASCUNHO') THEN
    RAISE EXCEPTION 'A pauta está % e já não aceita alterações (use a correcção com motivo)', COALESCE(NULLIF(v_estado_antigo, 'RASCUNHO'), v_estado_novo);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3) Pautas: nascem em RASCUNHO; transições válidas; PUBLICADA totalmente imutável; só o dono apaga (limpezas).
CREATE OR REPLACE FUNCTION pauta_transicao_valida() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT e_dono_das_tabelas() AND (NEW.estado <> 'RASCUNHO' OR NEW."validadaEm" IS NOT NULL OR NEW."publicadaEm" IS NOT NULL
        OR NEW."validadaPorId" IS NOT NULL OR NEW."publicadaPorId" IS NOT NULL) THEN
      RAISE EXCEPTION 'Uma pauta nasce sempre em rascunho';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF NOT e_dono_das_tabelas() THEN
      RAISE EXCEPTION 'Pautas não se apagam';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW."turmaId" <> OLD."turmaId" OR NEW."periodoId" <> OLD."periodoId" OR NEW."anoLectivoId" <> OLD."anoLectivoId" THEN
    RAISE EXCEPTION 'A turma e o período de uma pauta não mudam';
  END IF;
  IF OLD.estado = 'PUBLICADA' THEN
    RAISE EXCEPTION 'Uma pauta publicada é definitiva';
  END IF;
  IF NEW.estado <> OLD.estado AND NOT (
       (OLD.estado = 'RASCUNHO' AND NEW.estado = 'VALIDADA')
    OR (OLD.estado = 'VALIDADA' AND NEW.estado IN ('PUBLICADA', 'RASCUNHO'))
  ) THEN
    RAISE EXCEPTION 'Transição de pauta inválida: % → %', OLD.estado, NEW.estado;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS pauta_transicao ON "PautaPublicacao";
CREATE TRIGGER pauta_transicao BEFORE INSERT OR UPDATE OR DELETE ON "PautaPublicacao" FOR EACH ROW EXECUTE FUNCTION pauta_transicao_valida();

-- 4) TRUNCATE não dispara gatilhos de linha: trava-se aqui (e a aplicação nem tem privilégio de TRUNCATE).
CREATE OR REPLACE FUNCTION bloquear_truncate() RETURNS trigger AS $$
BEGIN
  IF NOT e_dono_das_tabelas() THEN
    RAISE EXCEPTION 'TRUNCATE não é permitido em %', TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER nota_sem_truncate BEFORE TRUNCATE ON "Nota" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER avaliacao_sem_truncate BEFORE TRUNCATE ON "Avaliacao" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();
CREATE TRIGGER pauta_sem_truncate BEFORE TRUNCATE ON "PautaPublicacao" FOR EACH STATEMENT EXECUTE FUNCTION bloquear_truncate();

-- 5) Correcção de uma nota de pauta PUBLICADA: a ÚNICA via para a aplicação. Corre com os direitos do dono (SECURITY DEFINER),
--    valida tudo e regista a auditoria na MESMA transacção (sem motivo ou fora de pauta publicada, falha).
CREATE OR REPLACE FUNCTION corrigir_nota_publicada(p_nota uuid, p_valor integer, p_actor uuid, p_motivo text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_antes integer;
  v_estudante uuid;
  v_avaliacao uuid;
  v_turma uuid;
  v_periodo uuid;
  v_estado "EstadoPauta";
  v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  IF p_valor IS NULL OR p_valor < 0 OR p_valor > 2000 THEN RAISE EXCEPTION 'Valor inválido (0 a 2000 centésimas)'; END IF;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)'; END IF;
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Autor obrigatório'; END IF;

  SELECT n.valor, n."estudanteId", a.id, a."turmaId", a."periodoId"
    INTO v_antes, v_estudante, v_avaliacao, v_turma, v_periodo
    FROM "Nota" n JOIN "Avaliacao" a ON a.id = n."avaliacaoId" WHERE n.id = p_nota;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota inexistente'; END IF;

  SELECT p.estado INTO v_estado FROM "PautaPublicacao" p WHERE p."turmaId" = v_turma AND p."periodoId" = v_periodo FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'PUBLICADA' THEN RAISE EXCEPTION 'Só se corrige uma nota de uma pauta publicada'; END IF;
  IF v_antes = p_valor THEN RAISE EXCEPTION 'O valor é igual ao actual'; END IF;

  UPDATE "Nota" SET valor = p_valor, "lancadaPorId" = p_actor, "updatedAt" = now() WHERE id = p_nota;
  INSERT INTO "EventoAuditoria" (id, "actorId", acao, entidade, "entidadeId", antes, depois, ip, em)
  VALUES (gen_random_uuid(), p_actor, 'NOTA_CORRIGIDA_APOS_PUBLICACAO', 'Nota', p_nota::text,
          jsonb_build_object('valor', v_antes),
          jsonb_build_object('valor', p_valor, 'motivo', v_motivo, 'avaliacaoId', v_avaliacao, 'estudanteId', v_estudante),
          p_ip, now());
END;
$$;
REVOKE ALL ON FUNCTION corrigir_nota_publicada(uuid, integer, uuid, text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lamanus_app') THEN
    GRANT EXECUTE ON FUNCTION corrigir_nota_publicada(uuid, integer, uuid, text, text) TO lamanus_app;
  END IF;
END $$;
