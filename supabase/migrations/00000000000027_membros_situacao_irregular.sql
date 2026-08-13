-- Terceiro estado de situação do membro: mais de 12 competências vencidas
-- e não pagas (o dobro do limiar que já torna INATIVO) marca o membro como
-- IRREGULAR — degrau mais grave, que também para de gerar mensalidade nova
-- e sai dos cálculos de inadimplência/Grande Loja (lib/domain/inadimplencia.ts).

alter table public.membros
  drop constraint membros_situacao_check;

alter table public.membros
  add constraint membros_situacao_check check (situacao in ('ATIVO', 'INATIVO', 'IRREGULAR'));
