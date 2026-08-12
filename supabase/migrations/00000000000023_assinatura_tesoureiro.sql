-- Recibo passa a ter duas assinaturas (Venerável Mestre + Tesoureiro),
-- lado a lado no PDF. Mesmo padrão da assinatura existente: path no bucket
-- privado loja-assinaturas, congelado em cada recibo no momento da emissão
-- (CLAUDE.md §5 — alterar configuração futura nunca altera histórico).

alter table public.loja_config
  add column assinatura_tesoureiro_url text;

alter table public.recibos
  add column assinatura_tesoureiro_url text;
