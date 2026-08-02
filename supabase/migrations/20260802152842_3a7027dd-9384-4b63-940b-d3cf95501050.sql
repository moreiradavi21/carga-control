ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'quarta_secao';

CREATE OR REPLACE FUNCTION public.is_quarta_secao(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'quarta_secao'
  ) INTO ok;
  RETURN ok;
END; $$;

REVOKE ALL ON FUNCTION public.is_quarta_secao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_quarta_secao(uuid) TO authenticated;

DROP POLICY IF EXISTS "View own cautelas or comandante" ON public.cautelas;
CREATE POLICY "View own cautelas or comandante" ON public.cautelas
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_comandante(auth.uid()) OR public.is_quarta_secao(auth.uid()));

DROP POLICY IF EXISTS "Comandantes view audit" ON public.audit_logs;
CREATE POLICY "Comandantes view audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_comandante(auth.uid()) OR public.is_quarta_secao(auth.uid()));