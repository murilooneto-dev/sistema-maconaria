-- A assinatura do Venerável Mestre autentica documentos financeiros (recibos)
-- e não deve ficar no bucket público loja-assets (usado pelo logo, que é
-- legitimamente público). Cria um bucket privado dedicado, legível apenas
-- por usuários autenticados (review final da Fase 4, item 2).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'loja-assinaturas',
  'loja-assinaturas',
  false,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

create policy "loja_assinaturas_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'loja-assinaturas');

create policy "loja_assinaturas_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'loja-assinaturas' and public.is_admin());

create policy "loja_assinaturas_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'loja-assinaturas' and public.is_admin())
  with check (bucket_id = 'loja-assinaturas' and public.is_admin());
