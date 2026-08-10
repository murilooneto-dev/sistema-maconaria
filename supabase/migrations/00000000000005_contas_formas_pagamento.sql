create table public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  saldo_inicial numeric(12,2) not null default 0,
  data_saldo_inicial date not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contas enable row level security;

create policy "contas_select_authenticated"
  on public.contas for select to authenticated using (true);

create policy "contas_write_admin"
  on public.contas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger contas_set_updated_at
  before update on public.contas
  for each row execute function public.set_updated_at();

create table public.formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.formas_pagamento enable row level security;

create policy "formas_pagamento_select_authenticated"
  on public.formas_pagamento for select to authenticated using (true);

create policy "formas_pagamento_write_admin"
  on public.formas_pagamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger formas_pagamento_set_updated_at
  before update on public.formas_pagamento
  for each row execute function public.set_updated_at();
