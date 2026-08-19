-- Centros de custo: agrupamento de categorias de movimentação definido pelo
-- usuário em Configurações, usado para organizar o dashboard financeiro
-- ("Visão geral" da tela Financeiro) por área/finalidade em vez de por
-- categoria crua. Ver docs/superpowers/specs/2026-08-19-dashboard-centros-de-custo-design.md.

create table public.centros_de_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default '#64748b',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.centros_de_custo enable row level security;

create policy "centros_de_custo_select_authenticated"
  on public.centros_de_custo for select to authenticated using (true);

create policy "centros_de_custo_write_admin"
  on public.centros_de_custo for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger centros_de_custo_set_updated_at
  before update on public.centros_de_custo
  for each row execute function public.set_updated_at();

-- Vínculo N:N: uma categoria pode pertencer a mais de um centro de custo
-- (decisão de produto — os totais dos cards podem então se sobrepor quando
-- houver categorias compartilhadas entre centros; comportamento intencional).
create table public.centros_de_custo_categorias (
  centro_de_custo_id uuid not null references public.centros_de_custo(id) on delete cascade,
  categoria_id uuid not null references public.categorias_movimentacao(id) on delete cascade,
  primary key (centro_de_custo_id, categoria_id)
);

create index centros_de_custo_categorias_categoria_idx on public.centros_de_custo_categorias (categoria_id);

alter table public.centros_de_custo_categorias enable row level security;

create policy "centros_de_custo_categorias_select_authenticated"
  on public.centros_de_custo_categorias for select to authenticated using (true);

create policy "centros_de_custo_categorias_write_admin"
  on public.centros_de_custo_categorias for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
