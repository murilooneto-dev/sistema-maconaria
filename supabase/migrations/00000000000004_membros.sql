create table public.membros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  matricula text not null unique,
  do_quadro boolean not null default true,
  remido boolean not null default false,
  recolhe boolean not null default false,
  situacao text not null default 'ATIVO' check (situacao in ('ATIVO', 'INATIVO')),
  data_cadastro date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index membros_situacao_idx on public.membros (situacao);
create index membros_do_quadro_idx on public.membros (do_quadro);

alter table public.membros enable row level security;

create policy "membros_select_authenticated"
  on public.membros for select to authenticated using (true);

create policy "membros_write_admin"
  on public.membros for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger membros_set_updated_at
  before update on public.membros
  for each row execute function public.set_updated_at();
