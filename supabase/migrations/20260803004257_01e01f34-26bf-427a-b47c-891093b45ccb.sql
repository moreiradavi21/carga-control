ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_tipo_key;
CREATE INDEX IF NOT EXISTS contratos_tipo_idx ON public.contratos (tipo);