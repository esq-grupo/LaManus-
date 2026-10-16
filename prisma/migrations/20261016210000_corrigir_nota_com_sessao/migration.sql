-- Revisão n.º 2 da Entrega D: a função de correcção não pode confiar num "autor" passado pelo chamador.
--
-- Antes: corrigir_nota_publicada(nota, valor, AUTOR, motivo, ip) — qualquer ligação da aplicação podia chamá-la com o UUID
-- de alguém da Direcção (ou até de um docente) e a correcção ficava atribuída a essa pessoa.
-- Agora: a função recebe o TOKEN DA SESSÃO do utilizador autenticado, valida-o na base de dados (só o hash está guardado:
-- quem não tem o token não o consegue forjar a partir da tabela Session) e DEDUZ o autor e a permissão dos dados:
--   · sessão existente, não revogada, dentro do prazo absoluto e de inactividade (30 min), utilizador ACTIVO;
--   · o utilizador tem a permissão `notas:corrigir` através dos seus papéis.
-- O autor e a sessão ficam na auditoria. Não existe argumento "autor".
DROP FUNCTION IF EXISTS corrigir_nota_publicada(uuid, integer, uuid, text, text);

CREATE OR REPLACE FUNCTION corrigir_nota_publicada(p_nota uuid, p_valor integer, p_token_sessao text, p_motivo text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_sessao uuid;
  v_actor uuid;
  v_antes integer;
  v_estudante uuid;
  v_avaliacao uuid;
  v_turma uuid;
  v_periodo uuid;
  v_estado "EstadoPauta";
  v_motivo text := btrim(coalesce(p_motivo, ''));
BEGIN
  -- 1) Autenticar: o token em claro só existe no browser e no servidor da aplicação.
  IF p_token_sessao IS NULL OR length(p_token_sessao) < 20 THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  SELECT s.id, s."userId" INTO v_sessao, v_actor
    FROM "Session" s JOIN "User" u ON u.id = s."userId"
   WHERE s."tokenHash" = encode(sha256(convert_to(p_token_sessao, 'UTF8')), 'hex')
     AND s."revogadaEm" IS NULL
     AND s."expiraEm" > now()
     AND s."ultimaActividade" > now() - interval '30 minutes'
     AND u.estado = 'ACTIVO';
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;

  -- 2) Autorizar: o autor tem a permissão notas:corrigir (através dos papéis)?
  IF NOT EXISTS (
    SELECT 1 FROM "UserRole" ur
      JOIN "RolePermission" rp ON rp."roleId" = ur."roleId"
      JOIN "Permission" p ON p.id = rp."permissionId"
     WHERE ur."userId" = v_actor AND p.codigo = 'notas:corrigir'
  ) THEN RAISE EXCEPTION 'Sem permissão para corrigir notas'; END IF;

  -- 3) Validar o pedido.
  IF p_valor IS NULL OR p_valor < 0 OR p_valor > 2000 THEN RAISE EXCEPTION 'Valor inválido (0 a 2000 centésimas)'; END IF;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório (mínimo 5 caracteres)'; END IF;

  SELECT n.valor, n."estudanteId", a.id, a."turmaId", a."periodoId"
    INTO v_antes, v_estudante, v_avaliacao, v_turma, v_periodo
    FROM "Nota" n JOIN "Avaliacao" a ON a.id = n."avaliacaoId" WHERE n.id = p_nota;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nota inexistente'; END IF;

  SELECT p.estado INTO v_estado FROM "PautaPublicacao" p WHERE p."turmaId" = v_turma AND p."periodoId" = v_periodo FOR UPDATE;
  IF v_estado IS DISTINCT FROM 'PUBLICADA' THEN RAISE EXCEPTION 'Só se corrige uma nota de uma pauta publicada'; END IF;
  IF v_antes = p_valor THEN RAISE EXCEPTION 'O valor é igual ao actual'; END IF;

  UPDATE "Nota" SET valor = p_valor, "lancadaPorId" = v_actor, "updatedAt" = now() WHERE id = p_nota;
  INSERT INTO "EventoAuditoria" (id, "actorId", acao, entidade, "entidadeId", antes, depois, ip, em)
  VALUES (gen_random_uuid(), v_actor, 'NOTA_CORRIGIDA_APOS_PUBLICACAO', 'Nota', p_nota::text,
          jsonb_build_object('valor', v_antes),
          jsonb_build_object('valor', p_valor, 'motivo', v_motivo, 'avaliacaoId', v_avaliacao, 'estudanteId', v_estudante, 'sessaoId', v_sessao),
          p_ip, now());
END;
$$;
REVOKE ALL ON FUNCTION corrigir_nota_publicada(uuid, integer, text, text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lamanus_app') THEN
    GRANT EXECUTE ON FUNCTION corrigir_nota_publicada(uuid, integer, text, text, text) TO lamanus_app;
  END IF;
END $$;
