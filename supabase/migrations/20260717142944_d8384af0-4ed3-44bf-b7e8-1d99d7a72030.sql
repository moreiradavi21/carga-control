
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('comandante', 'telefonista');
CREATE TYPE public.situacao_equipamento AS ENUM ('disponivel','em_cautela','extraviado','em_sindicancia','baixado','em_manutencao');
CREATE TYPE public.status_cautela AS ENUM ('ativa','finalizada','cancelada');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  posto_graduacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_comandante(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'comandante')
$$;

-- Profiles policies
CREATE POLICY "Auth users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Comandantes manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid())) WITH CHECK (public.is_comandante(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_comandante(auth.uid()));
CREATE POLICY "Comandantes manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid())) WITH CHECK (public.is_comandante(auth.uid()));

-- ============ HANDLE NEW USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, posto_graduacao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'posto_graduacao'
  );
  -- default role telefonista
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'telefonista'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ UPDATED AT ============
CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ COMPANHIAS ============
CREATE TABLE public.companhias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ordem INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.companhias TO authenticated;
GRANT ALL ON public.companhias TO service_role;
ALTER TABLE public.companhias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view companhias" ON public.companhias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comandantes manage companhias" ON public.companhias FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid())) WITH CHECK (public.is_comandante(auth.uid()));

INSERT INTO public.companhias (nome, ordem) VALUES
('1ª CIA', 1),('2ª CIA', 2),('3ª CIA', 3),('CCAp', 4),('Ap Log', 5),('Estado-Maior', 6);

-- ============ CATEGORIAS ============
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  UNIQUE(nome, parent_id)
);
GRANT SELECT ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comandantes manage categorias" ON public.categorias FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid())) WITH CHECK (public.is_comandante(auth.uid()));

-- Seed categorias
DO $$
DECLARE
  harris_id UUID; motorola_id UUID; sat_id UUID; som_id UUID; div_id UUID;
  bat_id UUID; carr_id UUID;
BEGIN
  INSERT INTO public.categorias (nome, ordem) VALUES ('Harris', 1) RETURNING id INTO harris_id;
  INSERT INTO public.categorias (nome, parent_id) VALUES
    ('Falcon III', harris_id),('RF-7800H', harris_id),('RF-7850', harris_id),
    ('RF-7800V', harris_id),('RF-5800', harris_id);

  INSERT INTO public.categorias (nome, ordem) VALUES ('Motorola', 2) RETURNING id INTO motorola_id;
  INSERT INTO public.categorias (nome, parent_id) VALUES
    ('APX', motorola_id),('DEP', motorola_id),('DTR', motorola_id),('Repetidoras', motorola_id);

  INSERT INTO public.categorias (nome, ordem) VALUES ('Baterias', 3);
  INSERT INTO public.categorias (nome, ordem) VALUES ('Microfones', 4);

  INSERT INTO public.categorias (nome, ordem) VALUES ('Satelitais', 5) RETURNING id INTO sat_id;
  INSERT INTO public.categorias (nome, parent_id) VALUES
    ('Iridium', sat_id),('SpotX', sat_id),('Starlink', sat_id),
    ('VSAT', sat_id),('TL63', sat_id),('Antenas', sat_id),('Terminais', sat_id);

  INSERT INTO public.categorias (nome, ordem) VALUES ('Carregadores', 6) RETURNING id INTO carr_id;
  INSERT INTO public.categorias (nome, parent_id) VALUES
    ('Carregadores Harris', carr_id),('Carregadores Motorola', carr_id),('Fontes', carr_id),('Cabos', carr_id);

  INSERT INTO public.categorias (nome, ordem) VALUES ('Som', 7) RETURNING id INTO som_id;
  INSERT INTO public.categorias (nome, parent_id) VALUES
    ('Caixas', som_id),('Amplificadores', som_id),('Microfones', som_id),
    ('Mesas', som_id),('Cabos', som_id);

  INSERT INTO public.categorias (nome, ordem) VALUES ('Materiais Diversos', 8) RETURNING id INTO div_id;
  INSERT INTO public.categorias (nome, parent_id) VALUES
    ('Cabos', div_id),('Conectores', div_id),('Ferramentas', div_id),
    ('Mastros', div_id),('Maletas', div_id),('Adaptadores', div_id);
END $$;

-- ============ EQUIPAMENTOS ============
CREATE TABLE public.equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio TEXT UNIQUE,
  numero_serie TEXT UNIQUE,
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id),
  marca TEXT,
  modelo TEXT,
  localizacao TEXT,
  situacao situacao_equipamento NOT NULL DEFAULT 'disponivel',
  observacoes TEXT,
  foto_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.equipamentos (situacao);
CREATE INDEX ON public.equipamentos (categoria_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view equipamentos" ON public.equipamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comandantes manage equipamentos" ON public.equipamentos FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid())) WITH CHECK (public.is_comandante(auth.uid()));

CREATE TRIGGER trg_equipamentos_updated BEFORE UPDATE ON public.equipamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ CAUTELAS ============
CREATE SEQUENCE public.cautela_seq;

CREATE TABLE public.cautelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  companhia_id UUID NOT NULL REFERENCES public.companhias(id),
  data_saida TIMESTAMPTZ NOT NULL DEFAULT now(),
  previsao_devolucao TIMESTAMPTZ,
  militar_responsavel TEXT NOT NULL,
  posto_responsavel TEXT,
  militar_retirada TEXT NOT NULL,
  posto_retirada TEXT,
  finalidade TEXT,
  observacoes TEXT,
  status status_cautela NOT NULL DEFAULT 'ativa',
  assinatura_entrega TEXT, -- data URL base64
  assinatura_recebimento TEXT,
  created_by UUID REFERENCES auth.users(id),
  finalizada_em TIMESTAMPTZ,
  finalizada_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cautelas TO authenticated;
GRANT ALL ON public.cautelas TO service_role;
ALTER TABLE public.cautelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view cautelas" ON public.cautelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create cautelas" ON public.cautelas FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Auth update own cautelas or comandante" ON public.cautelas FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_comandante(auth.uid()));
CREATE POLICY "Comandantes delete cautelas" ON public.cautelas FOR DELETE TO authenticated USING (public.is_comandante(auth.uid()));

CREATE TRIGGER trg_cautelas_updated BEFORE UPDATE ON public.cautelas
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE OR REPLACE FUNCTION public.gerar_numero_cautela()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  n INT;
BEGIN
  n := nextval('public.cautela_seq');
  RETURN to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.tg_cautela_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.gerar_numero_cautela();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cautelas_numero BEFORE INSERT ON public.cautelas
FOR EACH ROW EXECUTE FUNCTION public.tg_cautela_numero();

-- ============ CAUTELA ITENS ============
CREATE TABLE public.cautela_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cautela_id UUID NOT NULL REFERENCES public.cautelas(id) ON DELETE CASCADE,
  equipamento_id UUID NOT NULL REFERENCES public.equipamentos(id),
  devolvido BOOLEAN NOT NULL DEFAULT false,
  devolvido_em TIMESTAMPTZ,
  condicao_devolucao TEXT,
  observacoes_devolucao TEXT,
  situacao_pos_devolucao situacao_equipamento,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cautela_id, equipamento_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cautela_itens TO authenticated;
GRANT ALL ON public.cautela_itens TO service_role;
ALTER TABLE public.cautela_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view cautela_itens" ON public.cautela_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage cautela_itens" ON public.cautela_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enforce: só disponíveis podem ser cautelados
CREATE OR REPLACE FUNCTION public.tg_check_disponivel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE sit situacao_equipamento;
BEGIN
  SELECT situacao INTO sit FROM public.equipamentos WHERE id = NEW.equipamento_id;
  IF sit <> 'disponivel' THEN
    RAISE EXCEPTION 'Equipamento % não está disponível (situação: %)', NEW.equipamento_id, sit;
  END IF;
  UPDATE public.equipamentos SET situacao='em_cautela', updated_at=now() WHERE id = NEW.equipamento_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cautela_item_ins BEFORE INSERT ON public.cautela_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_check_disponivel();

-- ============ MOVIMENTACOES ============
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  situacao_anterior situacao_equipamento,
  situacao_nova situacao_equipamento,
  cautela_id UUID REFERENCES public.cautelas(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  ip TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.movimentacoes (equipamento_id, created_at DESC);
CREATE INDEX ON public.movimentacoes (created_at DESC);
GRANT SELECT, INSERT ON public.movimentacoes TO authenticated;
GRANT ALL ON public.movimentacoes TO service_role;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view mov" ON public.movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert mov" ON public.movimentacoes FOR INSERT TO authenticated WITH CHECK (true);

-- Auto register history on equipment situacao change
CREATE OR REPLACE FUNCTION public.tg_equip_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.movimentacoes (equipamento_id, tipo, situacao_nova, user_id, descricao)
    VALUES (NEW.id, 'criado', NEW.situacao, auth.uid(), 'Equipamento cadastrado');
  ELSIF TG_OP = 'UPDATE' AND OLD.situacao IS DISTINCT FROM NEW.situacao THEN
    INSERT INTO public.movimentacoes (equipamento_id, tipo, situacao_anterior, situacao_nova, user_id, descricao)
    VALUES (NEW.id, 'mudanca_situacao', OLD.situacao, NEW.situacao, auth.uid(),
      'Situação alterada de '||OLD.situacao||' para '||NEW.situacao);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_equip_history_ins AFTER INSERT ON public.equipamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_equip_history();
CREATE TRIGGER trg_equip_history_upd AFTER UPDATE ON public.equipamentos
FOR EACH ROW EXECUTE FUNCTION public.tg_equip_history();

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  ip TEXT,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_logs (created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comandantes view audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_comandante(auth.uid()));
CREATE POLICY "Auth insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============ FINALIZAR CAUTELA (RPC) ============
CREATE OR REPLACE FUNCTION public.finalizar_cautela(
  _cautela_id UUID,
  _itens JSONB -- [{equipamento_id, condicao, observacoes, situacao_pos}]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item JSONB;
  eq_id UUID;
  nova_sit situacao_equipamento;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    eq_id := (item->>'equipamento_id')::UUID;
    nova_sit := COALESCE((item->>'situacao_pos')::situacao_equipamento, 'disponivel');
    UPDATE public.cautela_itens
    SET devolvido = true,
        devolvido_em = now(),
        condicao_devolucao = item->>'condicao',
        observacoes_devolucao = item->>'observacoes',
        situacao_pos_devolucao = nova_sit
    WHERE cautela_id = _cautela_id AND equipamento_id = eq_id;
    UPDATE public.equipamentos SET situacao = nova_sit, updated_at = now() WHERE id = eq_id;
  END LOOP;

  UPDATE public.cautelas
  SET status = 'finalizada',
      finalizada_em = now(),
      finalizada_por = auth.uid()
  WHERE id = _cautela_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.finalizar_cautela(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_comandante(UUID) TO authenticated;
