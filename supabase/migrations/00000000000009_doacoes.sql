create table public.doacoes (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id),
  doador text not null,
  membro_id uuid references public.membros(id),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  conta_id uuid not null references public.contas(id),
  forma_pagamento_id uuid not null references public.formas_pagamento(id),
  observacao text,
  usuario_id uuid not null references public.profiles(id),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'CANCELADO')),
  motivo_cancelamento text,
  cancelado_por uuid references public.profiles(id),
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doacoes_cancelamento_check check (
    (status = 'ATIVO' and motivo_cancelamento is null and cancelado_por is null and cancelado_em is null)
    or (status = 'CANCELADO' and motivo_cancelamento is not null and cancelado_por is not null and cancelado_em is not null)
  )
);

create index doacoes_campanha_idx on public.doacoes (campanha_id);
create index doacoes_membro_idx on public.doacoes (membro_id);
create index doacoes_status_idx on public.doacoes (status);

alter table public.doacoes enable row level security;

create policy "doacoes_select_authenticated"
  on public.doacoes for select to authenticated using (true);

create policy "doacoes_write_tesoureiro"
  on public.doacoes for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger doacoes_set_updated_at
  before update on public.doacoes
  for each row execute function public.set_updated_at();
