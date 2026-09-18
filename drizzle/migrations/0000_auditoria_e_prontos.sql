ALTER TYPE public.situacao_equipamento ADD VALUE IF NOT EXISTS 'em_transferencia';
ALTER TYPE public.situacao_equipamento ADD VALUE IF NOT EXISTS 'pef_def';
ALTER TYPE public.situacao_equipamento ADD VALUE IF NOT EXISTS 'em_missao';

ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS responsavel_atual text,
  ADD COLUMN IF NOT EXISTS localizacao_atual text;

CREATE TABLE IF NOT EXISTS public.prontos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data_conferencia timestamptz NOT NULL DEFAULT now(),
  of_de_dia text,
  scmt text,
  cmt_pel_com text,
  responsavel_conferencia text,
  total integer NOT NULL DEFAULT 0,
  no_pelotao integer NOT NULL DEFAULT 0,
  fora integer NOT NULL DEFAULT 0,
  baixados integer NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.prontos TO authenticated;
GRANT ALL ON public.prontos TO service_role;

ALTER TABLE public.prontos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users view prontos"
ON public.prontos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Comandantes create prontos"
ON public.prontos FOR INSERT TO authenticated
WITH CHECK (public.is_comandante(auth.uid()) AND criado_por = auth.uid());

CREATE OR REPLACE FUNCTION public.verificar_integridade_carga()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resultado jsonb := '{}';
  sem_patrimonio integer;
  patrimonios_dup jsonb;
  cautelados_sem_cautela jsonb;
  baixados_em_cautela jsonb;
BEGIN
  SELECT COUNT(*) INTO sem_patrimonio
  FROM public.equipamentos
  WHERE (patrimonio IS NULL OR patrimonio = '')
    AND (numero_serie IS NULL OR numero_serie = '');

  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
  INTO patrimonios_dup
  FROM (
    SELECT patrimonio, COUNT(*) as qtd
    FROM public.equipamentos
    WHERE patrimonio IS NOT NULL AND patrimonio != ''
    GROUP BY patrimonio
    HAVING COUNT(*) > 1
    ORDER BY qtd DESC
  ) d;

  SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
  INTO cautelados_sem_cautela
  FROM (
    SELECT e.id, e.patrimonio, e.numero_serie, e.descricao, e.situacao
    FROM public.equipamentos e
    WHERE e.situacao IN ('em_cautela', 'cautela_servico')
      AND NOT EXISTS (
        SELECT 1 FROM public.cautela_itens ci
        JOIN public.cautelas c ON c.id = ci.cautela_id
        WHERE ci.equipamento_id = e.id AND c.status = 'ativa'
      )
    LIMIT 50
  ) e;

  SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
  INTO baixados_em_cautela
  FROM (
    SELECT e.id, e.patrimonio, e.descricao, e.situacao
    FROM public.equipamentos e
    WHERE e.situacao IN ('baixado', 'extraviado', 'descarga')
      AND EXISTS (
        SELECT 1 FROM public.cautela_itens ci
        JOIN public.cautelas c ON c.id = ci.cautela_id
        WHERE ci.equipamento_id = e.id AND c.status = 'ativa'
      )
    LIMIT 20
  ) e;

  resultado := jsonb_build_object(
    'sem_patrimonio_nem_serie', sem_patrimonio,
    'patrimonios_duplicados', patrimonios_dup,
    'cautelados_sem_cautela', cautelados_sem_cautela,
    'baixados_em_cautela_ativa', baixados_em_cautela,
    'verificado_em', now()::text
  );
  RETURN resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_integridade_carga() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verificar_integridade_carga() TO authenticated, service_role;

ALTER TABLE public.equipamentos
  ADD CONSTRAINT equipamentos_patrimonio_unique UNIQUE (patrimonio);