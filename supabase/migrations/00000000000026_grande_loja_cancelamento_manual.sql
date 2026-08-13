-- Rastreio de quem/quando/por que um item de repasse à Grande Loja foi
-- cancelado sem repasse (ex: marcado manualmente como "já repassado
-- anteriormente" — competência quitada fora do sistema antes de existir
-- o controle atual). Sem esses campos, não dá pra distinguir esse
-- cancelamento manual do cancelamento automático por estorno de
-- pagamento (lib/grande-loja/sincronizar-item.ts), que precisa continuar
-- podendo reverter sozinho quando o pagamento for refeito.

alter table public.repasses_grande_loja_itens
  add column cancelado_por uuid references public.profiles(id),
  add column cancelado_em timestamptz,
  add column motivo_cancelamento text;

-- Backfill dos itens já CANCELADO antes desta migration: todos vieram do
-- caminho automático (estorno de pagamento) — era o único que existia até
-- aqui. cancelado_por fica nulo (ator não registrado na época).
update public.repasses_grande_loja_itens
set
  motivo_cancelamento = 'Pagamento da competência revertido/cancelado',
  cancelado_em = updated_at
where status = 'CANCELADO' and motivo_cancelamento is null;

alter table public.repasses_grande_loja_itens
  add constraint repasses_itens_cancelamento_check check (
    status <> 'CANCELADO' or motivo_cancelamento is not null
  );
