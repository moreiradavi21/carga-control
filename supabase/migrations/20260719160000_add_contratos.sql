-- Migration: Contratos e Pagamentos Mensais
-- Execute este SQL no Supabase SQL Editor (via Lovable ou dashboard)

-- Tabela de contratos (um registro por tipo de contrato)
CREATE TABLE IF NOT EXISTS contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL UNIQUE, -- 'spot_x' | 'satelital' | 'telefonia' | 'starlink'
  fornecedor text NOT NULL,
  data_inicio date NOT NULL,
  data_validade date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de pagamentos mensais por contrato
CREATE TABLE IF NOT EXISTS pagamentos_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  arquivo_nome text,
  arquivo_url text,
  pago boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contrato_id, ano, mes)
);

-- Habilitar RLS
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_contrato ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados podem ler/gravar
CREATE POLICY "auth_contratos_all" ON contratos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_pagamentos_all" ON pagamentos_contrato
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bucket de storage para arquivos de pagamento
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('contratos-pagamentos', 'contratos-pagamentos', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Política de storage: usuários autenticados
CREATE POLICY "auth_contratos_storage_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'contratos-pagamentos')
  WITH CHECK (bucket_id = 'contratos-pagamentos');
