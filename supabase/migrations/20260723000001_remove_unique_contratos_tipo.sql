-- Remove restrição UNIQUE de tipo para permitir múltiplos contratos por tipo
ALTER TABLE contratos DROP CONSTRAINT IF EXISTS contratos_tipo_key;

-- Índice para manter performance nas buscas por tipo
CREATE INDEX IF NOT EXISTS idx_contratos_tipo ON contratos(tipo);

-- Adiciona descrição/número do contrato para identificar contratos do mesmo tipo
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS descricao_contrato text;
