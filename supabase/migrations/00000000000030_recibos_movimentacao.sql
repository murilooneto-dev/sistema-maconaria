-- Fase 10 (extensão): permite gerar recibo a partir de qualquer entrada
-- financeira lançada manualmente (não só mensalidade/campanha), para membro
-- cadastrado ou pessoa digitada livremente (recibos.pessoa já era texto
-- livre). Ver docs/superpowers/plans/2026-09-08-recibo-movimentacao.md.

alter table public.recibos
  add column movimentacao_id uuid references public.movimentacoes(id);

alter table public.recibos
  drop constraint recibos_origem_check;

alter table public.recibos
  drop constraint recibos_tipo_check;

alter table public.recibos
  add constraint recibos_tipo_check check (tipo in ('MENSALIDADE', 'CAMPANHA', 'MOVIMENTACAO'));

alter table public.recibos
  add constraint recibos_origem_check check (
    (tipo = 'MENSALIDADE' and pagamento_id is not null and doacao_id is null and movimentacao_id is null)
    or (tipo = 'CAMPANHA' and doacao_id is not null and pagamento_id is null and movimentacao_id is null)
    or (tipo = 'MOVIMENTACAO' and movimentacao_id is not null and pagamento_id is null and doacao_id is null)
  );

create index recibos_movimentacao_idx on public.recibos (movimentacao_id);
