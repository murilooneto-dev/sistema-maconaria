create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.profiles(id),
  modulo text not null,
  acao text not null,
  registro_tabela text,
  registro_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  descricao text,
  created_at timestamptz not null default now()
);

create index auditoria_usuario_idx on public.auditoria (usuario_id);
create index auditoria_modulo_idx on public.auditoria (modulo);
create index auditoria_created_at_idx on public.auditoria (created_at desc);
create index auditoria_registro_idx on public.auditoria (registro_tabela, registro_id);

alter table public.auditoria enable row level security;

create policy "auditoria_select_admin"
  on public.auditoria for select to authenticated
  using (public.is_admin());
