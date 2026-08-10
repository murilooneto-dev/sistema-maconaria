create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  objetivo text,
  meta numeric(12,2) not null check (meta >= 0),
  pessoa_ajudada text,
  contato text,
  endereco text,
  descricao text,
  data_inicial date not null,
  data_final date,
  status text not null default 'EM_ANDAMENTO' check (status in ('EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campanhas_datas_check check (data_final is null or data_final >= data_inicial)
);

create index campanhas_status_idx on public.campanhas (status);

alter table public.campanhas enable row level security;

create policy "campanhas_select_authenticated"
  on public.campanhas for select to authenticated using (true);

create policy "campanhas_write_tesoureiro"
  on public.campanhas for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger campanhas_set_updated_at
  before update on public.campanhas
  for each row execute function public.set_updated_at();
