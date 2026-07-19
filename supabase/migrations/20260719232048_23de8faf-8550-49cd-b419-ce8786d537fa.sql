ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS aguarda_guia_pef boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_auditorio text;

CREATE INDEX IF NOT EXISTS idx_equipamentos_pef
  ON public.equipamentos (aguarda_guia_pef)
  WHERE aguarda_guia_pef = true;

CREATE INDEX IF NOT EXISTS idx_equipamentos_sindicancia
  ON public.equipamentos (situacao)
  WHERE situacao = 'em_sindicancia';