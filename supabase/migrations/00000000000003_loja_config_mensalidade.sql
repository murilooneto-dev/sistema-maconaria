create table public.loja_config (
  id smallint primary key default 1 check (id = 1),
  nome text not null,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loja_config enable row level security;

create policy "loja_config_select_authenticated"
  on public.loja_config for select to authenticated using (true);

create policy "loja_config_write_admin"
  on public.loja_config for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger loja_config_set_updated_at
  before update on public.loja_config
  for each row execute function public.set_updated_at();

create table public.config_mensalidade (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('NORMAL', 'REMIDO')),
  valor_mensalidade numeric(12,2) not null check (valor_mensalidade >= 0),
  valor_grande_loja numeric(12,2) not null check (valor_grande_loja >= 0 and valor_grande_loja <= valor_mensalidade),
  valor_loja numeric(12,2) generated always as (valor_mensalidade - valor_grande_loja) stored,
  vigente_desde timestamptz not null default now(),
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index config_mensalidade_tipo_vigente_idx on public.config_mensalidade (tipo, vigente_desde desc);

alter table public.config_mensalidade enable row level security;

create policy "config_mensalidade_select_authenticated"
  on public.config_mensalidade for select to authenticated using (true);

create policy "config_mensalidade_insert_admin"
  on public.config_mensalidade for insert to authenticated
  with check (public.is_admin());
