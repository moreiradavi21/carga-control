-- ============================================================
-- Tabela: pef_materiais
-- Finalidade: Controle de material do PEF / DEF (independente
--             da carga do pelotão)
-- Acesso: role pef (leitura/escrita) + comandante (total)
-- ============================================================

create table if not exists public.pef_materiais (
  id                uuid        primary key default gen_random_uuid(),
  descricao         text        not null,
  quantidade        integer     not null default 1,
  unidade           text        not null default 'UN',
  numero_catalogo   text,
  situacao          text        not null default 'disponivel',
  observacoes       text,
  pef_unidade       text,       -- identificador da unidade PEF responsável
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint pef_materiais_situacao_check check (
    situacao in ('disponivel','em_uso','em_manutencao','aguardando_baixa','baixado')
  )
);

-- Atualiza updated_at automaticamente
create or replace function public.set_pef_materiais_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_pef_materiais_updated_at on public.pef_materiais;
create trigger trg_pef_materiais_updated_at
  before update on public.pef_materiais
  for each row execute procedure public.set_pef_materiais_updated_at();

-- RLS
alter table public.pef_materiais enable row level security;

-- Leitura: pef e comandante
create policy "pef_materiais_select"
  on public.pef_materiais for select
  using (
    exists (
      select 1 from public.usuarios u
      where u.user_id = auth.uid()
        and u.status = 'aprovado'
        and u.role in ('pef', 'comandante', 'adjunto')
    )
  );

-- Inserção: pef e comandante
create policy "pef_materiais_insert"
  on public.pef_materiais for insert
  with check (
    exists (
      select 1 from public.usuarios u
      where u.user_id = auth.uid()
        and u.status = 'aprovado'
        and u.role in ('pef', 'comandante')
    )
  );

-- Atualização: pef e comandante
create policy "pef_materiais_update"
  on public.pef_materiais for update
  using (
    exists (
      select 1 from public.usuarios u
      where u.user_id = auth.uid()
        and u.status = 'aprovado'
        and u.role in ('pef', 'comandante')
    )
  );

-- Exclusão: somente comandante
create policy "pef_materiais_delete"
  on public.pef_materiais for delete
  using (
    exists (
      select 1 from public.usuarios u
      where u.user_id = auth.uid()
        and u.status = 'aprovado'
        and u.role = 'comandante'
    )
  );
