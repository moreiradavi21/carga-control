
CREATE TABLE IF NOT EXISTS public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL UNIQUE,
  fornecedor TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_validade DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contratos"
  ON public.contratos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Comandantes manage contratos"
  ON public.contratos FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid()))
  WITH CHECK (public.is_comandante(auth.uid()));

CREATE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.pagamentos_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  arquivo_nome TEXT,
  arquivo_url TEXT,
  pago BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, ano, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_contrato TO authenticated;
GRANT ALL ON public.pagamentos_contrato TO service_role;

ALTER TABLE public.pagamentos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view pagamentos"
  ON public.pagamentos_contrato FOR SELECT TO authenticated USING (true);

CREATE POLICY "Comandantes manage pagamentos"
  ON public.pagamentos_contrato FOR ALL TO authenticated
  USING (public.is_comandante(auth.uid()))
  WITH CHECK (public.is_comandante(auth.uid()));

CREATE TRIGGER trg_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos_contrato
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
