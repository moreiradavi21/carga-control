CREATE OR REPLACE FUNCTION public.pef_unidade_do(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pef_unidade FROM public.profiles WHERE id = _user_id
$$;

REVOKE ALL ON FUNCTION public.pef_unidade_do(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pef_unidade_do(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, posto_graduacao, status, requested_role, pef_unidade)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'posto_graduacao',
    'pendente',
    COALESCE(NEW.raw_user_meta_data->>'role', 'telefonista'),
    NULLIF(NEW.raw_user_meta_data->>'pef_unidade', '')
  );
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "PEF insert material da propria unidade" ON public.materiais_pef;
CREATE POLICY "PEF insert material da propria unidade"
ON public.materiais_pef
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'pef')
  AND unidade = public.pef_unidade_do(auth.uid())
);