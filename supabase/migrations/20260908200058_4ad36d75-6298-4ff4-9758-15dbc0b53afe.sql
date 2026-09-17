CREATE OR REPLACE FUNCTION public.tg_profiles_prevent_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_comandante(auth.uid()) THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.requested_role IS DISTINCT FROM OLD.requested_role
       OR NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Not authorized to change role or status';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;