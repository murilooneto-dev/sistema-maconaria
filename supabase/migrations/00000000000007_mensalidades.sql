create table public.mensalidades (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id),
  ano integer not null check (ano >= 2000 and ano <= 2100),
  mes integer not null check (mes between 1 and 12),
  valor_devido numeric(12,2) not null check (valor_devido >= 0),
  valor_grande_loja numeric(12,2) not null check (valor_grande_loja >= 0),
  valor_loja numeric(12,2) not null check (valor_loja >= 0),
  valor_pago numeric(12,2) not null default 0 check (valor_pago >= 0),
  saldo numeric(12,2) generated always as (valor_devido - valor_pago) stored,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'PARCIAL', 'QUITADA', 'CANCELADA', 'NAO_APLICAVEL')),
  data_quitacao timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mensalidades_rateio_check check (valor_devido = valor_grande_loja + valor_loja),
  constraint mensalidades_valor_pago_limite check (valor_pago <= valor_devido)
);

create index mensalidades_membro_idx on public.mensalidades (membro_id);
create index mensalidades_ano_mes_idx on public.mensalidades (ano, mes);
create index mensalidades_status_idx on public.mensalidades (status);
create unique index mensalidades_membro_ano_mes_key
  on public.mensalidades (membro_id, ano, mes)
  where status <> 'CANCELADA';

alter table public.mensalidades enable row level security;

create policy "mensalidades_select_authenticated"
  on public.mensalidades for select to authenticated using (true);

create policy "mensalidades_write_tesoureiro"
  on public.mensalidades for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger mensalidades_set_updated_at
  before update on public.mensalidades
  for each row execute function public.set_updated_at();
