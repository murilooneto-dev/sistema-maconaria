-- supabase/seed.sql
--
-- Dados de desenvolvimento (não é dado financeiro real). Idempotente via
-- ON CONFLICT DO NOTHING, pode ser rodado múltiplas vezes com segurança.
--
-- Não inclui config_mensalidade: os valores de mensalidade são específicos
-- de cada Loja e devem ser configurados pelo Administrador na Fase 4
-- (Configurações), não inventados aqui.

insert into public.formas_pagamento (nome) values
  ('Dinheiro'),
  ('PIX'),
  ('Transferência'),
  ('Cartão'),
  ('Boleto'),
  ('Outros')
on conflict (nome) do nothing;

insert into public.loja_config (id, nome) values (1, 'Loja Maçônica')
on conflict (id) do nothing;
