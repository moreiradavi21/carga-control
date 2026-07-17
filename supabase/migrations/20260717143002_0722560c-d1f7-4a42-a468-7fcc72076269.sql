
ALTER FUNCTION public.tg_updated_at() SET search_path = public;
ALTER FUNCTION public.tg_cautela_numero() SET search_path = public;
ALTER FUNCTION public.gerar_numero_cautela() SET search_path = public;
ALTER FUNCTION public.tg_check_disponivel() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_comandante(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.finalizar_cautela(UUID, JSONB) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_comandante(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_cautela(UUID, JSONB) TO authenticated;
