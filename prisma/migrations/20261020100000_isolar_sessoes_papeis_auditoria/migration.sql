-- Entrega H — isolamento de sessões, papéis e auditoria (ADR-0008, decisão 13 do ADR-0003).
-- A aplicação (`lamanus_app`) deixa de poder criar sessões, mudar papéis/permissões ou escrever directamente na auditoria.

-- 1) Origem dos eventos de auditoria. BD = escrito por funções da base de dados que autenticaram o autor pela sessão
--    (a aplicação não o consegue forjar); APP = relatado pela aplicação. Os eventos anteriores a esta migração ficam como APP.
ALTER TABLE "EventoAuditoria" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'APP';
ALTER TABLE "EventoAuditoria" ALTER COLUMN "origem" SET DEFAULT 'BD';
ALTER TABLE "EventoAuditoria" ADD CONSTRAINT "Evento_origem_ck" CHECK ("origem" IN ('APP', 'BD'));

-- 2) Eventos relatados pela aplicação: a hora é a do servidor e a origem é sempre APP.
CREATE OR REPLACE FUNCTION registar_evento_app(p_actor uuid, p_acao text, p_entidade text, p_entidade_id text, p_antes jsonb, p_depois jsonb, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_acao IS NULL OR length(btrim(p_acao)) = 0 OR p_entidade IS NULL THEN RAISE EXCEPTION 'Evento inválido'; END IF;
  INSERT INTO "EventoAuditoria" (id, "actorId", acao, entidade, "entidadeId", antes, depois, ip, em, origem)
  VALUES (gen_random_uuid(), p_actor, left(p_acao, 100), left(p_entidade, 100), left(p_entidade_id, 200), p_antes, p_depois, left(p_ip, 100), now(), 'APP');
END;
$$;
REVOKE ALL ON FUNCTION registar_evento_app(uuid, text, text, text, jsonb, jsonb, text) FROM PUBLIC;

-- 3) Gestão de contas e papéis: só por estas funções, que autenticam o autor pelo TOKEN DA SESSÃO (permissão utilizadores:gerir).
CREATE OR REPLACE FUNCTION criar_utilizador(p_token_sessao text, p_email text, p_nome text, p_hash text, p_papeis text[], p_ip text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_id uuid := gen_random_uuid(); v_ids uuid[]; v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'utilizadores:gerir') a;
  IF v_email = '' OR length(btrim(coalesce(p_nome, ''))) < 2 OR coalesce(p_hash, '') = '' THEN RAISE EXCEPTION 'Dados do utilizador inválidos'; END IF;
  IF p_papeis IS NULL OR array_length(p_papeis, 1) IS NULL THEN RAISE EXCEPTION 'Indique pelo menos um papel'; END IF;
  SELECT array_agg(id) INTO v_ids FROM "Role" WHERE codigo = ANY (p_papeis);
  IF coalesce(array_length(v_ids, 1), 0) <> (SELECT count(DISTINCT x) FROM unnest(p_papeis) x) THEN RAISE EXCEPTION 'Papel inexistente'; END IF;
  INSERT INTO "User" (id, email, nome, "passwordHash", "updatedAt") VALUES (v_id, v_email, btrim(p_nome), p_hash, now());
  INSERT INTO "UserRole" ("userId", "roleId") SELECT v_id, unnest(v_ids);
  PERFORM auditar_conta(v_actor, v_sessao, 'UTILIZADOR_CRIADO', v_id, NULL, jsonb_build_object('email', v_email, 'papeis', to_jsonb(p_papeis)), p_ip);
  RETURN v_id;
END;
$$;

-- Auditoria das funções de contas (origem BD: o INSERT corre como dono, sem passar pela aplicação).
CREATE OR REPLACE FUNCTION auditar_conta(p_actor uuid, p_sessao uuid, p_acao text, p_alvo uuid, p_antes jsonb, p_depois jsonb, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO "EventoAuditoria" (id, "actorId", acao, entidade, "entidadeId", antes, depois, ip, em)
  VALUES (gen_random_uuid(), p_actor, p_acao, 'User', p_alvo::text, p_antes, COALESCE(p_depois, '{}'::jsonb) || jsonb_build_object('sessaoId', p_sessao), p_ip, now());
END;
$$;
REVOKE ALL ON FUNCTION auditar_conta(uuid, uuid, text, uuid, jsonb, jsonb, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION definir_papeis(p_token_sessao text, p_alvo uuid, p_papeis text[], p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_ids uuid[]; v_antes text[];
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'utilizadores:gerir') a;
  IF v_actor = p_alvo THEN RAISE EXCEPTION 'Não pode alterar os seus próprios papéis'; END IF;
  IF p_papeis IS NULL OR array_length(p_papeis, 1) IS NULL THEN RAISE EXCEPTION 'Indique pelo menos um papel'; END IF;
  PERFORM 1 FROM "User" WHERE id = p_alvo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utilizador inexistente'; END IF;
  SELECT array_agg(id) INTO v_ids FROM "Role" WHERE codigo = ANY (p_papeis);
  IF coalesce(array_length(v_ids, 1), 0) <> (SELECT count(DISTINCT x) FROM unnest(p_papeis) x) THEN RAISE EXCEPTION 'Papel inexistente'; END IF;
  SELECT array_agg(r.codigo ORDER BY r.codigo) INTO v_antes FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId" WHERE ur."userId" = p_alvo;
  DELETE FROM "UserRole" WHERE "userId" = p_alvo;
  INSERT INTO "UserRole" ("userId", "roleId") SELECT p_alvo, unnest(v_ids);
  PERFORM auditar_conta(v_actor, v_sessao, 'PAPEIS_ALTERADOS', p_alvo, jsonb_build_object('papeis', to_jsonb(v_antes)),
                        jsonb_build_object('papeis', (SELECT to_jsonb(array_agg(x ORDER BY x)) FROM unnest(p_papeis) x)), p_ip);
END;
$$;

CREATE OR REPLACE FUNCTION definir_estado_utilizador(p_token_sessao text, p_alvo uuid, p_estado text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_antes "EstadoUtilizador";
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'utilizadores:gerir') a;
  IF v_actor = p_alvo THEN RAISE EXCEPTION 'Não pode alterar o estado da sua própria conta'; END IF;
  IF p_estado NOT IN ('ACTIVO', 'DESACTIVADO') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  SELECT estado INTO v_antes FROM "User" WHERE id = p_alvo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Utilizador inexistente'; END IF;
  UPDATE "User" SET estado = p_estado::"EstadoUtilizador", "tentativasFalhadas" = 0, "bloqueadoAte" = NULL, "updatedAt" = now() WHERE id = p_alvo;
  IF p_estado = 'DESACTIVADO' THEN
    UPDATE "Session" SET "revogadaEm" = now() WHERE "userId" = p_alvo AND "revogadaEm" IS NULL;
  END IF;
  PERFORM auditar_conta(v_actor, v_sessao, CASE WHEN p_estado = 'ACTIVO' THEN 'UTILIZADOR_REACTIVADO' ELSE 'UTILIZADOR_DESACTIVADO' END, p_alvo,
                        jsonb_build_object('estado', v_antes), jsonb_build_object('estado', p_estado), p_ip);
END;
$$;

CREATE OR REPLACE FUNCTION revogar_sessoes_utilizador(p_token_sessao text, p_alvo uuid, p_ip text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid; v_sessao uuid; v_n integer;
BEGIN
  SELECT a.user_id, a.sessao_id INTO v_actor, v_sessao FROM autenticar_e_autorizar(p_token_sessao, 'utilizadores:gerir') a;
  UPDATE "Session" SET "revogadaEm" = now() WHERE "userId" = p_alvo AND "revogadaEm" IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    PERFORM auditar_conta(v_actor, v_sessao, 'SESSOES_REVOGADAS', p_alvo, NULL, jsonb_build_object('total', v_n, 'motivo', 'revogação pelo administrador'), p_ip);
  END IF;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION criar_utilizador(text, text, text, text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION definir_papeis(text, uuid, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION definir_estado_utilizador(text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION revogar_sessoes_utilizador(text, uuid, text) FROM PUBLIC;
