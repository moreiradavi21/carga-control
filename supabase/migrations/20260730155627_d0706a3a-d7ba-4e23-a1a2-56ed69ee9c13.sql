CREATE POLICY "descautela_imagens_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'descautela-imagens');
CREATE POLICY "descautela_imagens_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'descautela-imagens');
CREATE POLICY "descautela_imagens_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'descautela-imagens') WITH CHECK (bucket_id = 'descautela-imagens');