-- Fase 7 (Financeiro): catálogo editável de categorias de movimentação,
-- normalização de movimentacoes.categoria e bloqueio de cancelamento em
-- período fechado.

create table public.categorias_movimentacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('ENTRADA', 'SAIDA')),
  sistema boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categorias_movimentacao_nome_tipo_key unique (nome, tipo)
);

create index categorias_movimentacao_tipo_idx on public.categorias_movimentacao (tipo);

alter table public.categorias_movimentacao enable row level security;

create policy "categorias_movimentacao_select_authenticated"
  on public.categorias_movimentacao for select to authenticated using (true);

create policy "categorias_movimentacao_write_admin"
  on public.categorias_movimentacao for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create trigger categorias_movimentacao_set_updated_at
  before update on public.categorias_movimentacao
  for each row execute function public.set_updated_at();

-- Categoria de sistema: usada apenas pelo vínculo automático de pagamento
-- de mensalidade (Fase 7). Nunca editável/removível pela tela de
-- Configurações — protegida por trigger, o mesmo padrão usado em
-- config_mensalidade (Fase 4), porque service_role ignora RLS.
create function public.categorias_movimentacao_bloqueia_sistema()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Categoria de sistema não pode ser editada ou removida.';
end;
$$;

create trigger categorias_movimentacao_no_update_sistema
  before update on public.categorias_movimentacao
  for each row when (old.sistema) execute function public.categorias_movimentacao_bloqueia_sistema();

create trigger categorias_movimentacao_no_delete_sistema
  before delete on public.categorias_movimentacao
  for each row when (old.sistema) execute function public.categorias_movimentacao_bloqueia_sistema();

-- UUID fixo para a categoria de sistema "Mensalidade" — referenciado
-- diretamente pelo código (lib/financeiro/constantes.ts), sem precisar de
-- lookup por nome em cada pagamento.
insert into public.categorias_movimentacao (id, nome, tipo, sistema, ativo) values
  ('00000000-0000-0000-0000-000000000001', 'Mensalidade', 'ENTRADA', true, true),
  (gen_random_uuid(), 'Tronco', 'ENTRADA', false, true),
  (gen_random_uuid(), 'Recebimentos', 'ENTRADA', false, true),
  (gen_random_uuid(), 'Despesas', 'SAIDA', false, true),
  (gen_random_uuid(), 'Custos', 'SAIDA', false, true),
  (gen_random_uuid(), 'Pagamentos avulsos', 'SAIDA', false, true);

-- movimentacoes.categoria era texto livre; a tabela nunca foi populada
-- (Fase 6 não vinculava pagamento ao financeiro), então normalizar para FK
-- é seguro mesmo em produção.
alter table public.movimentacoes drop column categoria;
alter table public.movimentacoes
  add column categoria_id uuid not null references public.categorias_movimentacao(id);

create index movimentacoes_categoria_idx on public.movimentacoes (categoria_id);

-- Fechamento mensal (SPEC §22): bloqueia CANCELAMENTO de movimentações e
-- transferências cuja data caia num mês já fechado. Criação de novo
-- lançamento retroativo continua permitida (decisão do usuário,
-- 2026-08-12) — só o cancelamento/edição é bloqueado. Pagamentos de
-- mensalidade são verificados em código de aplicação (ver
-- app/(app)/mensalidades/pagamento/actions.ts) para não colidir com o
-- fluxo de compensação automática da Fase 6.
create function public.bloqueia_cancelamento_periodo_fechado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'CANCELADO' and old.status <> 'CANCELADO' then
    if exists (
      select 1 from public.fechamentos_mensais f
      where f.ano = extract(year from old.data)::int
        and f.mes = extract(month from old.data)::int
        and f.status = 'FECHADO'
    ) then
      raise exception 'Não é possível cancelar: o período %/% está fechado.',
        extract(month from old.data), extract(year from old.data);
    end if;
  end if;
  return new;
end;
$$;

create trigger movimentacoes_bloqueia_cancelamento_fechado
  before update on public.movimentacoes
  for each row execute function public.bloqueia_cancelamento_periodo_fechado();

create trigger transferencias_bloqueia_cancelamento_fechado
  before update on public.transferencias
  for each row execute function public.bloqueia_cancelamento_periodo_fechado();
