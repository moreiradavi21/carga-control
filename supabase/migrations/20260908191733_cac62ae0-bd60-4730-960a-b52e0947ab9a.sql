
-- Adjunto Pel: leitura total + inclusão/edição, sem exclusão
CREATE POLICY "Adjunto insert equipamentos" ON public.equipamentos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update equipamentos" ON public.equipamentos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto insert materiais_pef" ON public.materiais_pef FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update materiais_pef" ON public.materiais_pef FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto insert categorias" ON public.categorias FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update categorias" ON public.categorias FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto insert companhias" ON public.companhias FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update companhias" ON public.companhias FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update contratos" ON public.contratos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto insert pagamentos" ON public.pagamentos_contrato FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update pagamentos" ON public.pagamentos_contrato FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto view cautelas" ON public.cautelas FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update cautelas" ON public.cautelas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto insert cautela_itens" ON public.cautela_itens FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto update cautela_itens" ON public.cautela_itens FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'adjunto')) WITH CHECK (public.has_role(auth.uid(),'adjunto'));

CREATE POLICY "Adjunto view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto view user_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'adjunto'));
CREATE POLICY "Adjunto view audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'adjunto'));
