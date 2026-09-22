DROP POLICY IF EXISTS "Auth view mov" ON public.movimentacoes;
CREATE POLICY "Auth view mov"
ON public.movimentacoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'aprovado'
  )
);

DROP POLICY IF EXISTS "Auth view equipamentos" ON public.equipamentos;
CREATE POLICY "Auth view equipamentos"
ON public.equipamentos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'aprovado'
  )
);

DROP POLICY IF EXISTS "Auth users can view contratos" ON public.contratos;
CREATE POLICY "Auth users can view contratos"
ON public.contratos
FOR SELECT
TO authenticated
USING (
  public.is_comandante(auth.uid())
  OR public.is_quarta_secao(auth.uid())
  OR public.has_role(auth.uid(), 'adjunto'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'pef'::public.app_role)
    AND public.pef_unidade_do(auth.uid()) = ANY(
      CASE
        WHEN cardinality(pef_unidades) > 0 THEN pef_unidades
        WHEN pef_unidade IS NOT NULL THEN ARRAY[pef_unidade]
        ELSE ARRAY[]::text[]
      END
    )
  )
);

DROP POLICY IF EXISTS "Auth view materiais_pef" ON public.materiais_pef;
CREATE POLICY "Auth view materiais_pef"
ON public.materiais_pef
FOR SELECT
TO authenticated
USING (
  public.is_comandante(auth.uid())
  OR public.is_quarta_secao(auth.uid())
  OR public.has_role(auth.uid(), 'adjunto'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'pef'::public.app_role)
    AND unidade = public.pef_unidade_do(auth.uid())
  )
);

DROP POLICY IF EXISTS "Auth users view pagamentos" ON public.pagamentos_contrato;
CREATE POLICY "Auth users view pagamentos"
ON public.pagamentos_contrato
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contratos c
    WHERE c.id = pagamentos_contrato.contrato_id
  )
);

DROP POLICY IF EXISTS "Auth view companhias" ON public.companhias;
CREATE POLICY "Auth view companhias"
ON public.companhias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'aprovado'
  )
);

DROP POLICY IF EXISTS "Authenticated users view prontos" ON public.prontos;
CREATE POLICY "Authenticated users view prontos"
ON public.prontos
FOR SELECT
TO authenticated
USING (
  public.is_comandante(auth.uid())
  OR public.is_quarta_secao(auth.uid())
  OR public.has_role(auth.uid(), 'adjunto'::public.app_role)
);

DROP POLICY IF EXISTS "Auth view categorias" ON public.categorias;
CREATE POLICY "Auth view categorias"
ON public.categorias
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'aprovado'
  )
);

DROP POLICY IF EXISTS "Auth view cautela_itens" ON public.cautela_itens;
CREATE POLICY "Auth view cautela_itens"
ON public.cautela_itens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.cautelas c
    WHERE c.id = cautela_itens.cautela_id
      AND (
        c.created_by = auth.uid()
        OR public.is_comandante(auth.uid())
        OR public.is_quarta_secao(auth.uid())
        OR public.has_role(auth.uid(), 'adjunto'::public.app_role)
      )
  )
);