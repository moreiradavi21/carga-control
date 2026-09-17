CREATE POLICY "Auth read contratos pagamentos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contratos-pagamentos');
CREATE POLICY "Auth upload contratos pagamentos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contratos-pagamentos');
CREATE POLICY "Auth update contratos pagamentos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contratos-pagamentos');
CREATE POLICY "Auth delete contratos pagamentos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contratos-pagamentos');