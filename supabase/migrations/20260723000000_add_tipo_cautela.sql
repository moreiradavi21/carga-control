-- Adiciona tipo à tabela cautelas para diferenciar cautela padrão de cautela de serviço
ALTER TABLE cautelas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'padrao';

-- Garante que valores existentes sem tipo fiquem como 'padrao'
UPDATE cautelas SET tipo = 'padrao' WHERE tipo IS NULL;
