-- ============================================================
-- MIGRAÇÃO: Sistema de aprovação de cadastros
-- Execute este SQL no painel do Supabase: SQL Editor
-- ============================================================

-- 1. Adicionar colunas de status e função solicitada ao perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS requested_role text NOT NULL DEFAULT 'telefonista';

-- 2. Marcar todos os usuários já existentes como aprovados
UPDATE public.profiles SET status = 'aprovado';

-- 3. Garantir que novos cadastros iniciem como pendentes
--    (o DEFAULT 'pendente' já resolve; esta linha é só documentação)

-- 4. Política RLS: permitir que o próprio usuário leia seu perfil
--    (provavelmente já existe, mas garante)
-- DROP POLICY IF EXISTS "Usuário lê o próprio perfil" ON public.profiles;
-- CREATE POLICY "Usuário lê o próprio perfil"
--   ON public.profiles FOR SELECT
--   USING (auth.uid() = id);

-- ============================================================
-- ATENÇÃO: se houver um trigger que insere em user_roles
-- automaticamente ao criar um novo usuário, você deve
-- desativá-lo ou modificá-lo para não inserir enquanto
-- o status for 'pendente'. Verifique em:
-- Database → Triggers → procure por "on_auth_user_created"
-- ou similar. Se existir, edite-o para não inserir em
-- user_roles — a aprovação pelo Comandante fará isso.
-- ============================================================
