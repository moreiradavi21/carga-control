-- Migration: Adicionar colunas de assinatura na tabela cautelas
-- Execute este SQL no Supabase SQL Editor (via Lovable ou dashboard)

ALTER TABLE cautelas
  ADD COLUMN IF NOT EXISTS assinatura_emissor text,          -- quem fez a cautela
  ADD COLUMN IF NOT EXISTS assinatura_cmt_pelotao text,      -- Cmt do Pelotão
  ADD COLUMN IF NOT EXISTS assinatura_descautelamento text,  -- quem recebeu o material descautelado
  ADD COLUMN IF NOT EXISTS data_descautelamento date;        -- data da entrega do material descautelado
