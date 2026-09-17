-- 1. Profiles: restrict read
DROP POLICY IF EXISTS "Auth users can view profiles" ON public.profiles;
CREATE POLICY "View own profile or privileged" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_comandante(auth.uid()) OR public.is_quarta_secao(auth.uid()));

-- 2. Profiles: prevent self privilege escalation
CREATE OR REPLACE FUNCTION public.tg_profiles_prevent_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_comandante(auth.uid()) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.requested_role IS DISTINCT FROM OLD.requested_role
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Not authorized to change role or status';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_profiles_prevent_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_prevent_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_prevent_escalation();

-- 3. Storage: contratos-pagamentos -> comandante manage, quarta_secao read
DROP POLICY IF EXISTS "Auth read contratos pagamentos" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload contratos pagamentos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update contratos pagamentos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete contratos pagamentos" ON storage.objects;

CREATE POLICY "Contratos files read privileged" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'contratos-pagamentos'
  AND (public.is_comandante(auth.uid()) OR public.is_quarta_secao(auth.uid())));

CREATE POLICY "Contratos files insert comandante" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos-pagamentos' AND public.is_comandante(auth.uid()));

CREATE POLICY "Contratos files update comandante" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'contratos-pagamentos' AND public.is_comandante(auth.uid()))
WITH CHECK (bucket_id = 'contratos-pagamentos' AND public.is_comandante(auth.uid()));

CREATE POLICY "Contratos files delete comandante" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'contratos-pagamentos' AND public.is_comandante(auth.uid()));

-- 4. Storage: descautela-imagens -> owner scoped
DROP POLICY IF EXISTS "descautela_imagens_select" ON storage.objects;
DROP POLICY IF EXISTS "descautela_imagens_insert" ON storage.objects;
DROP POLICY IF EXISTS "descautela_imagens_update" ON storage.objects;

CREATE POLICY "descautela_imagens_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'descautela-imagens'
  AND (owner = auth.uid() OR public.is_comandante(auth.uid()) OR public.is_quarta_secao(auth.uid())));

CREATE POLICY "descautela_imagens_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'descautela-imagens' AND owner = auth.uid());

CREATE POLICY "descautela_imagens_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'descautela-imagens' AND (owner = auth.uid() OR public.is_comandante(auth.uid())))
WITH CHECK (bucket_id = 'descautela-imagens' AND (owner = auth.uid() OR public.is_comandante(auth.uid())));

CREATE POLICY "descautela_imagens_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'descautela-imagens' AND (owner = auth.uid() OR public.is_comandante(auth.uid())));

-- 5. Revoke direct execute on internal SECURITY DEFINER trigger functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_equip_history() FROM PUBLIC, anon, authenticated;