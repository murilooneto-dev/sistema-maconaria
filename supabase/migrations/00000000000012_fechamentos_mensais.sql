create table public.fechamentos_mensais (
  id uuid primary key default gen_random_uuid(),
  ano integer not null check (ano >= 2000 and ano <= 2100),
  mes integer not null check (mes between 1 and 12),
  saldo_inicial numeric(12,2) not null,
  total_entradas numeric(12,2) not null,
  total_saidas numeric(12,2) not null,
  total_transferencias numeric(12,2) not null,
  saldo_final numeric(12,2) not null,
  status text not null default 'ABERTO' check (status in ('ABERTO', 'FECHADO')),
  fechado_por uuid references public.profiles(id),
  fechado_em timestamptz,
  reaberto_por uuid references public.profiles(id),
  reaberto_em timestamptz,
  motivo_reabertura text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fechamentos_mensais_ano_mes_key unique (ano, mes),
  constraint fechamentos_mensais_saldo_check check (saldo_final = saldo_inicial + total_entradas - total_saidas)
);

create index fechamentos_mensais_ano_mes_idx on public.fechamentos_mensais (ano, mes);
create index fechamentos_mensais_status_idx on public.fechamentos_mensais (status);

alter table public.fechamentos_mensais enable row level security;

create policy "fechamentos_select_authenticated"
  on public.fechamentos_mensais for select to authenticated using (true);

create policy "fechamentos_insert_tesoureiro"
  on public.fechamentos_mensais for insert to authenticated
  with check (public.is_tesoureiro());

create policy "fechamentos_update_tesoureiro"
  on public.fechamentos_mensais for update to authenticated
  using (public.is_tesoureiro() and status = 'ABERTO')
  with check (public.is_tesoureiro());

create policy "fechamentos_update_admin"
  on public.fechamentos_mensais for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create trigger fechamentos_mensais_set_updated_at
  before update on public.fechamentos_mensais
  for each row execute function public.set_updated_at();
