-- Fase 9 (Grande Loja): repasse passa a debitar uma conta real (decisão do
-- usuário, 2026-08-12) — dinheiro de Grande Loja acumulado dentro do saldo
-- da Loja sai de fato do caixa quando o repasse é marcado como enviado.

-- not null: a tabela nunca foi populada (criação de repasses estava fora
-- de escopo até esta fase), então exigir a conta desde já é seguro.
alter table public.repasses_grande_loja
  add column conta_id uuid not null references public.contas(id);

-- Vínculo simétrico a movimentacoes.pagamento_id/doacao_id (Fases 6-8):
-- rastreia qual movimentação (SAIDA) foi gerada por qual repasse, para
-- poder cancelá-la junto se o repasse for cancelado.
alter table public.movimentacoes
  add column repasse_grande_loja_id uuid references public.repasses_grande_loja(id);

create index movimentacoes_repasse_idx on public.movimentacoes (repasse_grande_loja_id);

-- Categoria de sistema "Grande Loja" (SAIDA) — mesmo padrão de
-- "Mensalidade"/"Campanha": usada só pelo vínculo automático do repasse,
-- nunca selecionável/editável manualmente (protegida pelo trigger de
-- 00000000000020_financeiro_fase7.sql).
insert into public.categorias_movimentacao (id, nome, tipo, sistema, ativo) values
  ('00000000-0000-0000-0000-000000000003', 'Grande Loja', 'SAIDA', true, true);
