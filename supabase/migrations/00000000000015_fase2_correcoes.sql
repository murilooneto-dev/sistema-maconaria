-- Correções do review final da Fase 2 (Banco):
-- 1. Fecha policies "for all" que concediam DELETE implícito em tabelas
--    financeiras/cadastrais (viola a regra de nunca apagar fisicamente
--    movimentações financeiras). Substituídas por policies separadas de
--    insert/update, sem policy de delete (RLS nega DELETE por padrão).
-- 2. Aperta o "on delete cascade" de pagamento_mensalidades.pagamento_id
--    para "on delete restrict", evitando que a exclusão de um pagamento
--    apague silenciosamente os vínculos com competências.
-- 3. Corrige o check constraint de repasses_grande_loja_itens que impedia
--    um item ainda não agrupado em repasse (repasse_id is null) de ser
--    marcado como CANCELADO.
-- 4. Adiciona constraint de auditoria em fechamentos_mensais: se
--    status = 'FECHADO', fechado_por e fechado_em são obrigatórios.

-- =====================================================================
-- 1. RLS: substituir policies "for all" por insert/update (sem delete)
-- =====================================================================

-- loja_config
drop policy "loja_config_write_admin" on public.loja_config;

create policy "loja_config_write_admin_insert"
  on public.loja_config for insert to authenticated
  with check (public.is_admin());

create policy "loja_config_write_admin_update"
  on public.loja_config for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- membros
drop policy "membros_write_admin" on public.membros;

create policy "membros_write_admin_insert"
  on public.membros for insert to authenticated
  with check (public.is_admin());

create policy "membros_write_admin_update"
  on public.membros for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- contas
drop policy "contas_write_admin" on public.contas;

create policy "contas_write_admin_insert"
  on public.contas for insert to authenticated
  with check (public.is_admin());

create policy "contas_write_admin_update"
  on public.contas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- formas_pagamento
drop policy "formas_pagamento_write_admin" on public.formas_pagamento;

create policy "formas_pagamento_write_admin_insert"
  on public.formas_pagamento for insert to authenticated
  with check (public.is_admin());

create policy "formas_pagamento_write_admin_update"
  on public.formas_pagamento for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- campanhas
drop policy "campanhas_write_tesoureiro" on public.campanhas;

create policy "campanhas_write_tesoureiro_insert"
  on public.campanhas for insert to authenticated
  with check (public.is_tesoureiro());

create policy "campanhas_write_tesoureiro_update"
  on public.campanhas for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- mensalidades
drop policy "mensalidades_write_tesoureiro" on public.mensalidades;

create policy "mensalidades_write_tesoureiro_insert"
  on public.mensalidades for insert to authenticated
  with check (public.is_tesoureiro());

create policy "mensalidades_write_tesoureiro_update"
  on public.mensalidades for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- pagamentos
drop policy "pagamentos_write_tesoureiro" on public.pagamentos;

create policy "pagamentos_write_tesoureiro_insert"
  on public.pagamentos for insert to authenticated
  with check (public.is_tesoureiro());

create policy "pagamentos_write_tesoureiro_update"
  on public.pagamentos for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- pagamento_mensalidades
drop policy "pagamento_mensalidades_write_tesoureiro" on public.pagamento_mensalidades;

create policy "pagamento_mensalidades_write_tesoureiro_insert"
  on public.pagamento_mensalidades for insert to authenticated
  with check (public.is_tesoureiro());

create policy "pagamento_mensalidades_write_tesoureiro_update"
  on public.pagamento_mensalidades for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- doacoes
drop policy "doacoes_write_tesoureiro" on public.doacoes;

create policy "doacoes_write_tesoureiro_insert"
  on public.doacoes for insert to authenticated
  with check (public.is_tesoureiro());

create policy "doacoes_write_tesoureiro_update"
  on public.doacoes for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- movimentacoes
drop policy "movimentacoes_write_tesoureiro" on public.movimentacoes;

create policy "movimentacoes_write_tesoureiro_insert"
  on public.movimentacoes for insert to authenticated
  with check (public.is_tesoureiro());

create policy "movimentacoes_write_tesoureiro_update"
  on public.movimentacoes for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- transferencias
drop policy "transferencias_write_tesoureiro" on public.transferencias;

create policy "transferencias_write_tesoureiro_insert"
  on public.transferencias for insert to authenticated
  with check (public.is_tesoureiro());

create policy "transferencias_write_tesoureiro_update"
  on public.transferencias for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- repasses_grande_loja
drop policy "repasses_write_tesoureiro" on public.repasses_grande_loja;

create policy "repasses_write_tesoureiro_insert"
  on public.repasses_grande_loja for insert to authenticated
  with check (public.is_tesoureiro());

create policy "repasses_write_tesoureiro_update"
  on public.repasses_grande_loja for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- repasses_grande_loja_itens
drop policy "repasses_itens_write_tesoureiro" on public.repasses_grande_loja_itens;

create policy "repasses_itens_write_tesoureiro_insert"
  on public.repasses_grande_loja_itens for insert to authenticated
  with check (public.is_tesoureiro());

create policy "repasses_itens_write_tesoureiro_update"
  on public.repasses_grande_loja_itens for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

-- =====================================================================
-- 2. pagamento_mensalidades.pagamento_id: cascade -> restrict
-- =====================================================================

alter table public.pagamento_mensalidades
  drop constraint pagamento_mensalidades_pagamento_id_fkey,
  add constraint pagamento_mensalidades_pagamento_id_fkey
    foreign key (pagamento_id) references public.pagamentos(id) on delete restrict;

-- =====================================================================
-- 3. repasses_grande_loja_itens: permitir CANCELADO sem repasse
-- =====================================================================

alter table public.repasses_grande_loja_itens
  drop constraint repasses_itens_repasse_status_check;

alter table public.repasses_grande_loja_itens
  add constraint repasses_itens_repasse_status_check check (
    (repasse_id is null and status in ('PENDENTE', 'CANCELADO'))
    or (repasse_id is not null and status in ('ENVIADO', 'CANCELADO'))
  );

-- =====================================================================
-- 4. fechamentos_mensais: exigir auditoria quando FECHADO
-- =====================================================================

alter table public.fechamentos_mensais
  add constraint fechamentos_mensais_fechado_auditoria_check check (
    status <> 'FECHADO' or (fechado_por is not null and fechado_em is not null)
  );
