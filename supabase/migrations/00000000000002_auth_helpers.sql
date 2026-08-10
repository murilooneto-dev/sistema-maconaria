create extension if not exists pgcrypto;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid() and ativo = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_profile_role() = 'ADMINISTRADOR';
$$;

create or replace function public.is_tesoureiro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_profile_role() in ('ADMINISTRADOR', 'TESOUREIRO');
$$;
