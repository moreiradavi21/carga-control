ALTER TABLE public.materiais_pef
  ADD COLUMN IF NOT EXISTS tipo_material text NOT NULL DEFAULT 'permanente';

ALTER TABLE public.materiais_pef
  ADD CONSTRAINT materiais_pef_tipo_material_chk
  CHECK (tipo_material IN ('permanente','consumo'));