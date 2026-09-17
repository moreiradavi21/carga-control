ALTER TABLE public.cautelas
  ADD COLUMN IF NOT EXISTS data_descautela      timestamptz,
  ADD COLUMN IF NOT EXISTS quem_descautelou     text,
  ADD COLUMN IF NOT EXISTS situacao_devolucao   text DEFAULT 'sem_alteracoes',
  ADD COLUMN IF NOT EXISTS descricao_alteracoes text,
  ADD COLUMN IF NOT EXISTS imagem_alteracao_url text,
  ADD COLUMN IF NOT EXISTS descautelado_por     uuid,
  ADD COLUMN IF NOT EXISTS tipo                 text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS devolvido_com_alteracoes        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS descricao_alteracoes_devolucao  text;