-- Fase 8 (Campanhas): categoria de sistema para doações no financeiro.
-- Mesmo padrão da categoria "Mensalidade" (Fase 7) — usada apenas pelo
-- vínculo automático entre doação e movimentação, nunca selecionável
-- manualmente nem editável pela UI (protegida pelo trigger já criado em
-- 00000000000020_financeiro_fase7.sql, que bloqueia update/delete quando
-- sistema = true).
insert into public.categorias_movimentacao (id, nome, tipo, sistema, ativo) values
  ('00000000-0000-0000-0000-000000000002', 'Campanha', 'ENTRADA', true, true);
