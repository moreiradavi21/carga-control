ALTER TABLE public.cautela_itens DROP CONSTRAINT IF EXISTS cautela_itens_equipamento_id_fkey;
ALTER TABLE public.cautela_itens ADD CONSTRAINT cautela_itens_equipamento_id_fkey FOREIGN KEY (equipamento_id) REFERENCES public.equipamentos(id) ON DELETE CASCADE;

ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_equipamento_id_fkey;
ALTER TABLE public.movimentacoes ADD CONSTRAINT movimentacoes_equipamento_id_fkey FOREIGN KEY (equipamento_id) REFERENCES public.equipamentos(id) ON DELETE CASCADE;