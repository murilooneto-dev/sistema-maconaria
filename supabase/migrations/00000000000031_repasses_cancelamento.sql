-- Cancelamento de repasse à Grande Loja passa a registrar quem cancelou,
-- quando e por quê — mesmo padrão de movimentacoes, transferencias, doacoes
-- e repasses_grande_loja_itens (CLAUDE.md §8). Até aqui o repasse só mudava
-- de status, sem deixar rastro de autoria/motivo.

alter table public.repasses_grande_loja
  add column cancelado_por uuid references public.profiles(id),
  add column cancelado_em timestamptz,
  add column motivo_cancelamento text;

-- Repasses cancelados antes desta migration: o motivo e o autor nunca foram
-- registrados. cancelado_por fica nulo (ator desconhecido); a data usa o
-- updated_at, que foi o momento da mudança de status.
update public.repasses_grande_loja set
  motivo_cancelamento = 'Cancelado antes do registro de motivo (não informado)',
  cancelado_em = updated_at
where status = 'CANCELADO' and motivo_cancelamento is null;

alter table public.repasses_grande_loja
  add constraint repasses_grande_loja_cancelamento_check check (
    status <> 'CANCELADO' or (motivo_cancelamento is not null and cancelado_em is not null)
  );
