-- Migration: Descautela — campos de devolução em cautelas e flag em equipamentos
-- Execute este SQL no Supabase SQL Editor (via Lovable ou dashboard)

-- Campos de descautela na tabela cautelas
ALTER TABLE cautelas
  ADD COLUMN IF NOT EXISTS data_descautela      timestamptz,
  ADD COLUMN IF NOT EXISTS quem_descautelou     text,
  ADD COLUMN IF NOT EXISTS situacao_devolucao   text DEFAULT 'sem_alteracoes',
  ADD COLUMN IF NOT EXISTS descricao_alteracoes text,
  ADD COLUMN IF NOT EXISTS imagem_alteracao_url text,
  ADD COLUMN IF NOT EXISTS descautelado_por     uuid;

-- Flag de atenção em equipamentos devolvidos com alterações
ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS devolvido_com_alteracoes        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS descricao_alteracoes_devolucao  text;

-- Bucket de storage para imagens de alteração (opcional)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('descautela-imagens', 'descautela-imagens', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_descautela_imagens_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'descautela-imagens')
  WITH CHECK (bucket_id = 'descautela-imagens');
