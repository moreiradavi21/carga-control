CREATE OR REPLACE FUNCTION public.tg_check_disponivel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sit public.situacao_equipamento;
  tipo_cautela text;
  situacao_destino public.situacao_equipamento;
BEGIN
  SELECT situacao INTO sit
  FROM public.equipamentos
  WHERE id = NEW.equipamento_id
  FOR UPDATE;

  IF sit <> 'disponivel' THEN
    RAISE EXCEPTION 'Equipamento % não está disponível (situação: %)', NEW.equipamento_id, sit;
  END IF;

  SELECT COALESCE(tipo, 'padrao') INTO tipo_cautela
  FROM public.cautelas
  WHERE id = NEW.cautela_id;

  situacao_destino := CASE
    WHEN tipo_cautela = 'servico' THEN 'cautela_servico'::public.situacao_equipamento
    ELSE 'em_cautela'::public.situacao_equipamento
  END;

  UPDATE public.equipamentos
  SET situacao = situacao_destino,
      updated_at = now()
  WHERE id = NEW.equipamento_id;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tg_check_disponivel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_check_disponivel() TO service_role;

CREATE OR REPLACE FUNCTION public.tg_sync_equipamento_ao_remover_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cautela_itens ci
    JOIN public.cautelas c ON c.id = ci.cautela_id
    WHERE ci.equipamento_id = OLD.equipamento_id
      AND ci.id <> OLD.id
      AND c.status = 'ativa'
  ) THEN
    UPDATE public.equipamentos
    SET situacao = 'disponivel',
        updated_at = now()
    WHERE id = OLD.equipamento_id
      AND situacao IN ('em_cautela', 'cautela_servico');
  END IF;

  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.tg_sync_equipamento_ao_remover_item() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_sync_equipamento_ao_remover_item() TO service_role;

DROP TRIGGER IF EXISTS trg_cautela_item_del_sync ON public.cautela_itens;
CREATE TRIGGER trg_cautela_item_del_sync
AFTER DELETE ON public.cautela_itens
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_equipamento_ao_remover_item();

CREATE OR REPLACE FUNCTION public.tg_sync_equipamentos_status_cautela()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  situacao_destino public.situacao_equipamento;
BEGIN
  IF NEW.status = 'ativa' THEN
    situacao_destino := CASE
      WHEN COALESCE(NEW.tipo, 'padrao') = 'servico' THEN 'cautela_servico'::public.situacao_equipamento
      ELSE 'em_cautela'::public.situacao_equipamento
    END;

    UPDATE public.equipamentos e
    SET situacao = situacao_destino,
        updated_at = now()
    FROM public.cautela_itens ci
    WHERE ci.cautela_id = NEW.id
      AND ci.equipamento_id = e.id;
  ELSIF OLD.status = 'ativa' AND NEW.status <> 'ativa' THEN
    UPDATE public.equipamentos e
    SET situacao = 'disponivel',
        updated_at = now()
    FROM public.cautela_itens ci
    WHERE ci.cautela_id = NEW.id
      AND ci.equipamento_id = e.id
      AND NOT EXISTS (
        SELECT 1
        FROM public.cautela_itens ci2
        JOIN public.cautelas c2 ON c2.id = ci2.cautela_id
        WHERE ci2.equipamento_id = e.id
          AND c2.id <> NEW.id
          AND c2.status = 'ativa'
      );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.tg_sync_equipamentos_status_cautela() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_sync_equipamentos_status_cautela() TO service_role;

DROP TRIGGER IF EXISTS trg_cautela_status_sync_equipamentos ON public.cautelas;
CREATE TRIGGER trg_cautela_status_sync_equipamentos
AFTER UPDATE OF status, tipo ON public.cautelas
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.tipo IS DISTINCT FROM NEW.tipo)
EXECUTE FUNCTION public.tg_sync_equipamentos_status_cautela();

UPDATE public.equipamentos e
SET situacao = CASE
    WHEN COALESCE(c.tipo, 'padrao') = 'servico' THEN 'cautela_servico'::public.situacao_equipamento
    ELSE 'em_cautela'::public.situacao_equipamento
  END,
  updated_at = now()
FROM public.cautela_itens ci
JOIN public.cautelas c ON c.id = ci.cautela_id
WHERE ci.equipamento_id = e.id
  AND c.status = 'ativa'
  AND e.situacao IS DISTINCT FROM CASE
    WHEN COALESCE(c.tipo, 'padrao') = 'servico' THEN 'cautela_servico'::public.situacao_equipamento
    ELSE 'em_cautela'::public.situacao_equipamento
  END;