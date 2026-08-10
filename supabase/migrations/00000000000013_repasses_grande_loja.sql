create table public.repasses_grande_loja (
  id uuid primary key default gen_random_uuid(),
  data_envio date not null,
  usuario_id uuid not null references public.profiles(id),
  valor_total numeric(12,2) not null check (valor_total >= 0),
  observacao text,
  status text not null default 'ENVIADO' check (status in ('ENVIADO', 'CANCELADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.repasses_grande_loja enable row level security;

create policy "repasses_select_authenticated"
  on public.repasses_grande_loja for select to authenticated using (true);

create policy "repasses_write_tesoureiro"
  on public.repasses_grande_loja for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger repasses_grande_loja_set_updated_at
  before update on public.repasses_grande_loja
  for each row execute function public.set_updated_at();

create table public.repasses_grande_loja_itens (
  id uuid primary key default gen_random_uuid(),
  mensalidade_id uuid not null unique references public.mensalidades(id),
  repasse_id uuid references public.repasses_grande_loja(id),
  valor numeric(12,2) not null check (valor > 0),
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'ENVIADO', 'CANCELADO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repasses_itens_repasse_status_check check (
    (repasse_id is null and status = 'PENDENTE')
    or (repasse_id is not null and status in ('ENVIADO', 'CANCELADO'))
  )
);

create index repasses_itens_repasse_idx on public.repasses_grande_loja_itens (repasse_id);
create index repasses_itens_status_idx on public.repasses_grande_loja_itens (status);

alter table public.repasses_grande_loja_itens enable row level security;

create policy "repasses_itens_select_authenticated"
  on public.repasses_grande_loja_itens for select to authenticated using (true);

create policy "repasses_itens_write_tesoureiro"
  on public.repasses_grande_loja_itens for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger repasses_itens_set_updated_at
  before update on public.repasses_grande_loja_itens
  for each row execute function public.set_updated_at();
