create table public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tipo text not null check (tipo in ('ENTRADA', 'SAIDA')),
  categoria text not null,
  descricao text,
  valor numeric(12,2) not null check (valor > 0),
  conta_id uuid not null references public.contas(id),
  forma_pagamento_id uuid not null references public.formas_pagamento(id),
  membro_id uuid references public.membros(id),
  campanha_id uuid references public.campanhas(id),
  usuario_id uuid not null references public.profiles(id),
  origem text not null,
  pagamento_id uuid references public.pagamentos(id),
  doacao_id uuid references public.doacoes(id),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'CANCELADO')),
  motivo_cancelamento text,
  cancelado_por uuid references public.profiles(id),
  cancelado_em timestamptz,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint movimentacoes_cancelamento_check check (
    (status = 'ATIVO' and motivo_cancelamento is null and cancelado_por is null and cancelado_em is null)
    or (status = 'CANCELADO' and motivo_cancelamento is not null and cancelado_por is not null and cancelado_em is not null)
  )
);

create index movimentacoes_data_idx on public.movimentacoes (data);
create index movimentacoes_tipo_idx on public.movimentacoes (tipo);
create index movimentacoes_conta_idx on public.movimentacoes (conta_id);
create index movimentacoes_campanha_idx on public.movimentacoes (campanha_id);
create index movimentacoes_status_idx on public.movimentacoes (status);

alter table public.movimentacoes enable row level security;

create policy "movimentacoes_select_authenticated"
  on public.movimentacoes for select to authenticated using (true);

create policy "movimentacoes_write_tesoureiro"
  on public.movimentacoes for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger movimentacoes_set_updated_at
  before update on public.movimentacoes
  for each row execute function public.set_updated_at();

create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  conta_origem_id uuid not null references public.contas(id),
  conta_destino_id uuid not null references public.contas(id),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  observacao text,
  usuario_id uuid not null references public.profiles(id),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'CANCELADO')),
  motivo_cancelamento text,
  cancelado_por uuid references public.profiles(id),
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transferencias_contas_diferentes check (conta_origem_id <> conta_destino_id),
  constraint transferencias_cancelamento_check check (
    (status = 'ATIVO' and motivo_cancelamento is null and cancelado_por is null and cancelado_em is null)
    or (status = 'CANCELADO' and motivo_cancelamento is not null and cancelado_por is not null and cancelado_em is not null)
  )
);

create index transferencias_origem_idx on public.transferencias (conta_origem_id);
create index transferencias_destino_idx on public.transferencias (conta_destino_id);
create index transferencias_status_idx on public.transferencias (status);

alter table public.transferencias enable row level security;

create policy "transferencias_select_authenticated"
  on public.transferencias for select to authenticated using (true);

create policy "transferencias_write_tesoureiro"
  on public.transferencias for all to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger transferencias_set_updated_at
  before update on public.transferencias
  for each row execute function public.set_updated_at();
