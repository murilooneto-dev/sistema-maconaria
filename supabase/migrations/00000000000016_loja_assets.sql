alter table public.loja_config
  add column assinatura_url text;

insert into storage.buckets (id, name, public)
values ('loja-assets', 'loja-assets', true)
on conflict (id) do nothing;

-- storage.objects já vem com RLS habilitada por padrão em todo projeto Supabase,
-- não é necessário (nem seguro) tentar habilitar de novo aqui.

create policy "loja_assets_select_public"
  on storage.objects for select
  using (bucket_id = 'loja-assets');

create policy "loja_assets_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'loja-assets' and public.is_admin());

create policy "loja_assets_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'loja-assets' and public.is_admin())
  with check (bucket_id = 'loja-assets' and public.is_admin());
