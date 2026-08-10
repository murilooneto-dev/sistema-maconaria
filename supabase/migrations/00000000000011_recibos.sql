create table public.recibos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('MENSALIDADE', 'CAMPANHA')),
  membro_id uuid references public.membros(id),
  pessoa text not null,
  valor numeric(12,2) not null check (valor > 0),
  referencia text not null,
  data date not null,
  descricao text,
  assinatura_url text,
  usuario_id uuid not null references public.profiles(id),
  pagamento_id uuid references public.pagamentos(id),
  doacao_id uuid references public.doacoes(id),
  created_at timestamptz not null default now(),
  constraint recibos_origem_check check (
    (tipo = 'MENSALIDADE' and pagamento_id is not null and doacao_id is null)
    or (tipo = 'CAMPANHA' and doacao_id is not null and pagamento_id is null)
  )
);

create index recibos_membro_idx on public.recibos (membro_id);
create index recibos_tipo_idx on public.recibos (tipo);
create index recibos_data_idx on public.recibos (data);

alter table public.recibos enable row level security;

create policy "recibos_select_authenticated"
  on public.recibos for select to authenticated using (true);

create policy "recibos_insert_tesoureiro"
  on public.recibos for insert to authenticated
  with check (public.is_tesoureiro());
