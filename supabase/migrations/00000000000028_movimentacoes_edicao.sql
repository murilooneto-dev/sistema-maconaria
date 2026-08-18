-- Rastreabilidade de edição de movimentação (cancelar + recriar): a
-- movimentação nova aponta pra antiga que ela substituiu, permitindo
-- seguir a cadeia de edições diretamente por SQL/join, sem depender só de
-- parsear o texto de motivo_cancelamento.

alter table public.movimentacoes
  add column editada_de_id uuid references public.movimentacoes(id);

create index movimentacoes_editada_de_idx on public.movimentacoes (editada_de_id);
