ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pef';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pef_unidade text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS is_pef boolean NOT NULL DEFAULT false;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS pef_unidade text;