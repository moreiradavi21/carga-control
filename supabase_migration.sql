-- ============================================================
-- MIGRAÇÃO: Sistema de aprovação de cadastros + Conta Mestre
-- Execute este SQL no painel do Supabase: SQL Editor
-- ============================================================

-- 1. Adicionar colunas de status e função solicitada ao perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS requested_role text NOT NULL DEFAULT 'telefonista';

-- 2. Marcar todos os usuários já existentes como aprovados
UPDATE public.profiles SET status = 'aprovado';

-- ============================================================
-- CONTA MESTRE: moreira.pelcom.eb@gmail.com
-- Sempre Comandante, nunca precisa de aprovação
-- ============================================================

-- 3. Se a conta mestre já existe, garantir que está aprovada como comandante
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'moreira.pelcom.eb@gmail.com';
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
      SET status = 'aprovado', requested_role = 'comandante'
      WHERE id = v_user_id;

    INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'comandante')
      ON CONFLICT (user_id) DO UPDATE SET role = 'comandante';
  END IF;
END $$;

-- 4. Trigger: ao criar qualquer usuário, se for a conta mestre
--    aprovar automaticamente e atribuir role comandante
CREATE OR REPLACE FUNCTION public.auto_approve_master_commander()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'moreira.pelcom.eb@gmail.com' THEN
    UPDATE public.profiles
      SET status = 'aprovado', requested_role = 'comandante'
      WHERE id = NEW.id;

    INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'comandante')
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger anterior se existir e recriar
DROP TRIGGER IF EXISTS trg_auto_approve_master ON auth.users;
CREATE TRIGGER trg_auto_approve_master
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_master_commander();

-- ============================================================
-- ATENÇÃO: se houver um trigger que insere em user_roles
-- automaticamente ao criar qualquer novo usuário, você deve
-- desativá-lo para que novos usuários fiquem pendentes.
-- Verifique em: Database → Triggers → procure por
-- "on_auth_user_created" ou similar.
-- ============================================================
