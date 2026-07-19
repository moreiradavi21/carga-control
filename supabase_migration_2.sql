-- ============================================================
-- MIGRAÇÃO 2: PEF, notas de sindicância e Auditório
-- Execute este SQL no painel do Supabase: SQL Editor
-- ============================================================

-- 1. Campo para marcar material que está no PEF aguardando guia de transferência
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS aguarda_guia_pef boolean NOT NULL DEFAULT false;

-- 2. Campo para notas/observações do Auditório (sindicância)
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS notas_auditorio text;

-- 3. (Opcional) índice para consultas rápidas de PEF
CREATE INDEX IF NOT EXISTS idx_equipamentos_pef
  ON public.equipamentos (aguarda_guia_pef)
  WHERE aguarda_guia_pef = true;

-- 4. (Opcional) índice para sindicância
CREATE INDEX IF NOT EXISTS idx_equipamentos_sindicancia
  ON public.equipamentos (situacao)
  WHERE situacao = 'em_sindicancia';
