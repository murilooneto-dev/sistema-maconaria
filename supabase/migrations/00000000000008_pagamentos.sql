create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros(id),
  valor_total numeric(12,2) not null check (valor_total > 0),
  data_pagamento date not null,
  conta_id uuid not null references public.contas(id),
  forma_pagamento_id uuid not null references public.formas_pagamento(id),
  usuario_id uuid not null references public.profiles(id),
  observacao text,
  status text not null default 'ATIVO' check (status in ('ATIVO', 'CANCELADO')),
  motivo_cancelamento text,
  cancelado_por uuid references public.profiles(id),
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pagamentos_cancelamento_check check (
    (status = 'ATIVO' and motivo_cancelamento is null and cancelado_por is null and cancelado_em is null)
    or (status = 'CANCELADO' and motivo_cancelamento is not null and cancelado_por is not null and cancelado_em is not null)
  )
);

create index pagamentos_membro_idx on public.pagamentos (membro_id);
create index pagamentos_conta_idx on public.pagamentos (conta_id);
create index pagamentos_data_idx on public.pagamentos (data_pagamento);
create index pagamentos_status_idx on public.pagamentos (status);

alter table public.pagamentos enable row level security;

create policy "pagamentos_select_authenticated"
  on public.pagamentos for select to authenticated using (true);

create policy "pagamentos_write_tesoureiro"
  on public.pagamentos for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger pagamentos_set_updated_at
  before update on public.pagamentos
  for each row execute function public.set_updated_at();

create table public.pagamento_mensalidades (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete cascade,
  mensalidade_id uuid not null references public.mensalidades(id),
  valor_aplicado numeric(12,2) not null check (valor_aplicado > 0),
  created_at timestamptz not null default now(),
  constraint pagamento_mensalidades_unica unique (pagamento_id, mensalidade_id)
);

create index pagamento_mensalidades_pagamento_idx on public.pagamento_mensalidades (pagamento_id);
create index pagamento_mensalidades_mensalidade_idx on public.pagamento_mensalidades (mensalidade_id);

alter table public.pagamento_mensalidades enable row level security;

create policy "pagamento_mensalidades_select_authenticated"
  on public.pagamento_mensalidades for select to authenticated using (true);

create policy "pagamento_mensalidades_write_tesoureiro"
  on public.pagamento_mensalidades for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());
