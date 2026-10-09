-- Contas a pagar e a receber: compromissos futuros com data de vencimento,
-- que só viram dinheiro no caixa quando recebem BAIXA. A baixa cria uma
-- movimentação (SAIDA para PAGAR, ENTRADA para RECEBER) e guarda o vínculo
-- em movimentacao_id — a conta em si nunca entra em saldo ou relatório
-- financeiro, só a movimentação gerada.
--
-- `nome` é o que está sendo pago/recebido ("Energia", "Aluguel"), texto
-- livre com sugestão dos nomes já usados. Não confundir com public.contas
-- (contas bancárias/caixa), que só é escolhida na hora da baixa.
--
-- Recorrência: as parcelas são criadas todas de uma vez, uma linha por mês,
-- ligadas por recorrencia_id.
create table public.contas_pagar_receber (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('PAGAR', 'RECEBER')),
  nome text not null check (length(trim(nome)) > 0),
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  observacao text,
  recorrencia_id uuid,
  parcela integer,
  total_parcelas integer,
  status text not null default 'ABERTA' check (status in ('ABERTA', 'BAIXADA', 'CANCELADA')),
  data_baixa date,
  valor_baixa numeric(12,2) check (valor_baixa > 0),
  movimentacao_id uuid references public.movimentacoes(id),
  baixado_por uuid references public.profiles(id),
  baixado_em timestamptz,
  motivo_cancelamento text,
  cancelado_por uuid references public.profiles(id),
  cancelado_em timestamptz,
  usuario_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contas_pagar_receber_recorrencia_check check (
    (recorrencia_id is null and parcela is null and total_parcelas is null)
    or (recorrencia_id is not null and parcela between 1 and total_parcelas)
  ),
  constraint contas_pagar_receber_baixa_check check (
    (status = 'BAIXADA' and data_baixa is not null and valor_baixa is not null and baixado_por is not null and baixado_em is not null)
    or (status <> 'BAIXADA' and data_baixa is null and valor_baixa is null and movimentacao_id is null and baixado_por is null and baixado_em is null)
  ),
  constraint contas_pagar_receber_cancelamento_check check (
    (status = 'CANCELADA' and motivo_cancelamento is not null and cancelado_por is not null and cancelado_em is not null)
    or (status <> 'CANCELADA' and motivo_cancelamento is null and cancelado_por is null and cancelado_em is null)
  )
);

create index contas_pagar_receber_vencimento_idx on public.contas_pagar_receber (data_vencimento);
create index contas_pagar_receber_status_idx on public.contas_pagar_receber (status);
create unique index contas_pagar_receber_parcela_key
  on public.contas_pagar_receber (recorrencia_id, parcela)
  where recorrencia_id is not null;
create unique index contas_pagar_receber_movimentacao_key
  on public.contas_pagar_receber (movimentacao_id)
  where movimentacao_id is not null;

alter table public.contas_pagar_receber enable row level security;

create policy "contas_pagar_receber_select_authenticated"
  on public.contas_pagar_receber for select to authenticated using (true);

create policy "contas_pagar_receber_insert_tesoureiro"
  on public.contas_pagar_receber for insert to authenticated
  with check (public.is_tesoureiro());

create policy "contas_pagar_receber_update_tesoureiro"
  on public.contas_pagar_receber for update to authenticated
  using (public.is_tesoureiro()) with check (public.is_tesoureiro());

create trigger contas_pagar_receber_set_updated_at
  before update on public.contas_pagar_receber
  for each row execute function public.set_updated_at();

-- Um registro por dia em que o lembrete de vencimento foi enviado. A chave
-- primária na data é o que impede o mesmo lembrete de sair duas vezes se a
-- rotina agendada rodar mais de uma vez no dia. Só a aplicação (service
-- role) lê e escreve: RLS ligado e nenhuma policy.
create table public.lembretes_contas_envios (
  data date primary key,
  enviado_em timestamptz not null default now(),
  destinatarios integer not null check (destinatarios >= 0),
  contas integer not null check (contas >= 0)
);

alter table public.lembretes_contas_envios enable row level security;
