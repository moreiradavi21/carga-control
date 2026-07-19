
-- ============================================================
-- 1. cautela_itens: replace permissive ALL policy
-- ============================================================
DROP POLICY IF EXISTS "Auth manage cautela_itens" ON public.cautela_itens;

CREATE POLICY "Manage cautela_itens by owner or comandante"
  ON public.cautela_itens
  FOR ALL
  TO authenticated
  USING (
    public.is_comandante(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cautelas c
      WHERE c.id = cautela_itens.cautela_id
        AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.is_comandante(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cautelas c
      WHERE c.id = cautela_itens.cautela_id
        AND c.created_by = auth.uid()
    )
  );

-- ============================================================
-- 2. cautelas: scope SELECT to owner or comandante
-- ============================================================
DROP POLICY IF EXISTS "Auth view cautelas" ON public.cautelas;

CREATE POLICY "View own cautelas or comandante"
  ON public.cautelas
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_comandante(auth.uid())
  );

-- ============================================================
-- 3. movimentacoes: restrict INSERT
-- ============================================================
DROP POLICY IF EXISTS "Auth insert mov" ON public.movimentacoes;

CREATE POLICY "Insert own movimentacoes"
  ON public.movimentacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- 4. audit_logs: restrict INSERT
-- ============================================================
DROP POLICY IF EXISTS "Auth insert audit" ON public.audit_logs;

CREATE POLICY "Insert own audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 5. Revoke execute on SECURITY DEFINER functions from anon/public
--    Keep has_role and is_comandante executable to authenticated
--    (required by RLS policy evaluation).
-- ============================================================
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_comandante(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_comandante(uuid) TO authenticated, service_role;

-- finalizar_cautela: restrict to authenticated only; add in-function auth guard.
REVOKE ALL ON FUNCTION public.finalizar_cautela(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_cautela(uuid, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finalizar_cautela(_cautela_id uuid, _itens jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item JSONB;
  eq_id UUID;
  nova_sit situacao_equipamento;
  _uid uuid := auth.uid();
  _is_owner boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT (created_by = _uid) INTO _is_owner
    FROM public.cautelas WHERE id = _cautela_id;

  IF NOT COALESCE(_is_owner, false) AND NOT public.is_comandante(_uid) THEN
    RAISE EXCEPTION 'Not authorized to finalize this cautela';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    eq_id := (item->>'equipamento_id')::UUID;
    nova_sit := COALESCE((item->>'situacao_pos')::situacao_equipamento, 'disponivel');
    UPDATE public.cautela_itens
    SET devolvido = true,
        devolvido_em = now(),
        condicao_devolucao = item->>'condicao',
        observacoes_devolucao = item->>'observacoes',
        situacao_pos_devolucao = nova_sit
    WHERE cautela_id = _cautela_id AND equipamento_id = eq_id;
    UPDATE public.equipamentos SET situacao = nova_sit, updated_at = now() WHERE id = eq_id;
  END LOOP;

  UPDATE public.cautelas
  SET status = 'finalizada',
      finalizada_em = now(),
      finalizada_por = _uid
  WHERE id = _cautela_id;
END; $function$;

-- Trigger functions: never called directly by clients — revoke from clients.
REVOKE ALL ON FUNCTION public.tg_equip_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
