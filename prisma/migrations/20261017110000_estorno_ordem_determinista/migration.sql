-- Revisão interna da Entrega E: o estorno revertia «a alocação mais recente», mas as alocações de uma confirmação têm todas o mesmo
-- createdAt (mesma transacção), pelo que a ordem era aleatória (teste intermitente, reproduzido ~2 em 3). Passa a ser determinista.
-- Aprovar: reverte primeiro o crédito (valor ainda não alocado) e depois as alocações, do encargo mais recente para o mais antigo.
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

  -- Ordem determinista: o inverso EXACTO da alocação automática (que enche primeiro o encargo mais antigo). As alocações de uma
  -- confirmação nascem na mesma transacção (mesmo createdAt), por isso a ordem vem do encargo: vencimento, criação e id, decrescentes.
  FOR v_al IN
    SELECT a.id, a.valor FROM "AlocacaoPagamento" a JOIN "Encargo" e ON e.id = a."encargoId"
     WHERE a."pagamentoId" = v_pag.id ORDER BY e.vencimento DESC, e."createdAt" DESC, e.id DESC, a."createdAt" DESC, a.id DESC FOR UPDATE OF a LOOP
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

