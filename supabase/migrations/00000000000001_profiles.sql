-- supabase/migrations/00000000000001_profiles.sql

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  nome text not null,
  role text not null check (role in ('ADMINISTRADOR', 'TESOUREIRO', 'CONSULTA')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- qualquer usuário autenticado e ativo pode ler perfis (necessário para exibir
-- "quem registrou" em módulos futuros e para o próprio header)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- ninguém escreve em profiles via client; administração de usuários (Fase 3)
-- passa por Server Action com service role, não por INSERT/UPDATE direto do cliente.
-- Nenhuma policy de insert/update/delete é criada aqui de propósito.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
