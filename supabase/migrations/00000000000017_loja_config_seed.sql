-- Garante que a linha singleton loja_config(id=1) sempre existe.
-- O seed com esses dados é dev-only (supabase/seed.sql) e não é aplicado
-- automaticamente em produção; sem essa linha, atualizarLoja/atualizarAssinatura
-- fazem um UPDATE que não afeta nenhuma linha e falha silenciosamente
-- (ver review final da Fase 4, item 1).
insert into public.loja_config (id, nome)
values (1, 'Loja Maçônica')
on conflict (id) do nothing;

-- Limite server-side de tamanho/tipo de arquivo no bucket loja-assets,
-- que originalmente não tinha nenhuma restrição (review final da Fase 4, item 6).
update storage.buckets
set file_size_limit = 5242880, -- 5MB
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
where id = 'loja-assets';
