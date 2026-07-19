-- Adiciona campo para marcar material no PEF aguardando guia de transferência
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS aguarda_guia_pef boolean NOT NULL DEFAULT false;

-- Adiciona campo para notas/observações do Auditório (sindicância)
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS notas_auditorio text;

-- Índice para consultas rápidas de PEF
CREATE INDEX IF NOT EXISTS idx_equipamentos_pef
  ON public.equipamentos (aguarda_guia_pef)
  WHERE aguarda_guia_pef = true;

-- Índice para sindicância
CREATE INDEX IF NOT EXISTS idx_equipamentos_sindicancia
  ON public.equipamentos (situacao)
  WHERE situacao = 'em_sindicancia';
