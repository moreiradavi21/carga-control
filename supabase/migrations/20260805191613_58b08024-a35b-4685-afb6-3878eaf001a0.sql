CREATE TABLE public.materiais_pef (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade text NOT NULL,
  descricao text NOT NULL,
  patrimonio text,
  numero_serie text,
  marca text,
  modelo text,
  localizacao text,
  situacao text NOT NULL DEFAULT 'disponivel',
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_pef TO authenticated;
GRANT ALL ON public.materiais_pef TO service_role;

ALTER TABLE public.materiais_pef ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view materiais_pef" ON public.materiais_pef
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Comandantes manage materiais_pef" ON public.materiais_pef
  FOR ALL TO authenticated
  USING (is_comandante(auth.uid()))
  WITH CHECK (is_comandante(auth.uid()));

CREATE INDEX materiais_pef_unidade_idx ON public.materiais_pef (unidade);

CREATE TRIGGER materiais_pef_updated_at
  BEFORE UPDATE ON public.materiais_pef
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();