-- ============================================================
-- MIGRAÇÃO: Auditoria e Prontos da Reserva
-- Data: 17/09/2026
-- Objetivo: Ampliar situacoes, adicionar responsavel_atual,
--           criar tabela prontos e constraint de integridade
-- ============================================================

-- ── 1. NOVOS VALORES DO ENUM situacao_equipamento ────────────────────────────
-- ATENÇÃO: ADD VALUE não pode ser executado dentro de um bloco de transação.
-- Execute cada linha separadamente se necessário.

ALTER TYPE situacao_equipamento ADD VALUE IF NOT EXISTS 'em_transferencia';
ALTER TYPE situacao_equipamento ADD VALUE IF NOT EXISTS 'pef_def';
ALTER TYPE situacao_equipamento ADD VALUE IF NOT EXISTS 'em_missao';

-- ── 2. CAMPOS responsavel_atual e localizacao_atual em equipamentos ──────────
-- Permite saber rapidamente quem está com cada equipamento e onde ele está,
-- sem precisar fazer join com cautelas em todo momento.

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS responsavel_atual text,
  ADD COLUMN IF NOT EXISTS localizacao_atual text;

-- Preencher responsavel_atual para equipamentos já cautelados (dados existentes)
UPDATE equipamentos e
SET
  responsavel_atual = (
    SELECT CONCAT(
      COALESCE(c.posto_retirada || ' ', ''),
      COALESCE(c.militar_retirada, '')
    )
    FROM cautelas c
    JOIN cautela_itens ci ON ci.cautela_id = c.id
    WHERE ci.equipamento_id = e.id
      AND c.status = 'ativa'
    LIMIT 1
  ),
  localizacao_atual = (
    SELECT COALESCE(c.finalidade, comp.nome, e.localizacao)
    FROM cautelas c
    JOIN cautela_itens ci ON ci.cautela_id = c.id
    LEFT JOIN companhias comp ON comp.id = c.companhia_id
    WHERE ci.equipamento_id = e.id
      AND c.status = 'ativa'
    LIMIT 1
  )
WHERE e.situacao IN ('em_cautela', 'cautela_servico');

-- Para equipamentos disponíveis, localização = Pelotão de Comunicações
UPDATE equipamentos
SET localizacao_atual = 'Pel Com — Reserva'
WHERE situacao = 'disponivel'
  AND (localizacao_atual IS NULL OR localizacao_atual = '');

-- ── 3. TABELA prontos — Snapshots do Pronto da Reserva ──────────────────────
-- Cada registro representa um pronto gerado/finalizado.
-- O campo snapshot armazena o JSON completo da situação no momento da conferência.

CREATE TABLE IF NOT EXISTS prontos (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data_conferencia       timestamptz NOT NULL DEFAULT now(),
  of_de_dia              text,
  scmt                   text,
  cmt_pel_com            text,
  responsavel_conferencia text,
  total                  integer NOT NULL DEFAULT 0,
  no_pelotao             integer NOT NULL DEFAULT 0,
  fora                   integer NOT NULL DEFAULT 0,
  baixados               integer NOT NULL DEFAULT 0,
  -- snapshot: JSON com estado completo dos equipamentos no momento
  snapshot               jsonb NOT NULL DEFAULT '{}',
  criado_por             uuid,
  created_at             timestamptz DEFAULT now()
);

-- Habilitar RLS na tabela prontos
ALTER TABLE prontos ENABLE ROW LEVEL SECURITY;

-- Política: comandante pode inserir e ler; todos autenticados podem ler
CREATE POLICY "prontos_select" ON prontos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "prontos_insert" ON prontos
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── 4. CHECAGEM DE DUPLICIDADE DE PATRIMÔNIO ────────────────────────────────
-- ATENÇÃO: Antes de criar a constraint UNIQUE, verifique se há duplicatas:
--
-- SELECT patrimonio, COUNT(*) as qtd, array_agg(id) as ids
-- FROM equipamentos
-- WHERE patrimonio IS NOT NULL AND patrimonio != ''
-- GROUP BY patrimonio
-- HAVING COUNT(*) > 1
-- ORDER BY qtd DESC;
--
-- Se não houver duplicatas, execute:
-- ALTER TABLE equipamentos
--   ADD CONSTRAINT IF NOT EXISTS equipamentos_patrimonio_unique
--   UNIQUE (patrimonio);
--
-- (Comentado aqui para execução manual após verificar duplicatas)

-- ── 5. FUNÇÃO auxiliar: verificar integridade da carga ──────────────────────
-- Retorna JSON com as inconsistências encontradas no momento da chamada.

CREATE OR REPLACE FUNCTION verificar_integridade_carga()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado jsonb := '{}';
  sem_patrimonio integer;
  patrimonios_dup jsonb;
  cautelados_sem_cautela jsonb;
  baixados_em_cautela jsonb;
BEGIN
  -- 5a. Equipamentos sem patrimônio e sem número de série
  SELECT COUNT(*) INTO sem_patrimonio
  FROM equipamentos
  WHERE (patrimonio IS NULL OR patrimonio = '')
    AND (numero_serie IS NULL OR numero_serie = '');

  -- 5b. Patrimônios duplicados
  SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::jsonb)
  INTO patrimonios_dup
  FROM (
    SELECT patrimonio, COUNT(*) as qtd
    FROM equipamentos
    WHERE patrimonio IS NOT NULL AND patrimonio != ''
    GROUP BY patrimonio
    HAVING COUNT(*) > 1
    ORDER BY qtd DESC
  ) d;

  -- 5c. Equipamentos marcados como cautelados mas sem cautela ativa
  SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
  INTO cautelados_sem_cautela
  FROM (
    SELECT e.id, e.patrimonio, e.numero_serie, e.descricao, e.situacao
    FROM equipamentos e
    WHERE e.situacao IN ('em_cautela', 'cautela_servico')
      AND NOT EXISTS (
        SELECT 1 FROM cautela_itens ci
        JOIN cautelas c ON c.id = ci.cautela_id
        WHERE ci.equipamento_id = e.id AND c.status = 'ativa'
      )
    LIMIT 50
  ) e;

  -- 5d. Equipamentos marcados como baixado/extraviado que estão em cautela ativa
  SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
  INTO baixados_em_cautela
  FROM (
    SELECT e.id, e.patrimonio, e.descricao, e.situacao
    FROM equipamentos e
    WHERE e.situacao IN ('baixado', 'extraviado', 'descarga')
      AND EXISTS (
        SELECT 1 FROM cautela_itens ci
        JOIN cautelas c ON c.id = ci.cautela_id
        WHERE ci.equipamento_id = e.id AND c.status = 'ativa'
      )
    LIMIT 20
  ) e;

  resultado := jsonb_build_object(
    'sem_patrimonio_nem_serie', sem_patrimonio,
    'patrimonios_duplicados', patrimonios_dup,
    'cautelados_sem_cautela', cautelados_sem_cautela,
    'baixados_em_cautela_ativa', baixados_em_cautela,
    'verificado_em', now()::text
  );

  RETURN resultado;
END;
$$;

-- Permissão para usuários autenticados chamarem a função
GRANT EXECUTE ON FUNCTION verificar_integridade_carga() TO authenticated;
