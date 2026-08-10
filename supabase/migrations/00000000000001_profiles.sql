-- supabase/migrations/00000000000001_profiles.sql

-- username é armazenado sempre em minúsculas (ver lib/domain/auth.ts
-- normalizeUsername) porque é mapeado para um e-mail interno
-- "<username>@loja.internal" usado pelo Supabase Auth. O check abaixo
-- garante que apenas caracteres seguros para essa montagem de e-mail
-- sejam aceitos, e a unicidade é garantida via índice único em
-- lower(username) (não via UNIQUE simples na coluna), para não permitir
-- que 'Admin' e 'admin' coexistam como registros distintos colidindo no
-- mesmo e-mail interno.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9._-]+$'),
  nome text not null,
  role text not null check (role in ('ADMINISTRADOR', 'TESOUREIRO', 'CONSULTA')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- qualquer usuário autenticado pode ler todos os perfis, ativos ou não
-- (necessário para exibir "quem registrou" em módulos futuros e para o
-- próprio header); esta policy não verifica `ativo` — o bloqueio de
-- perfis inativos é feito na aplicação (app/(app)/layout.tsx), não aqui.
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
$$ language plpgsql
set search_path = '';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
