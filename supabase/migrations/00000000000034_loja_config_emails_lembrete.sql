-- E-mails que recebem o lembrete diário de contas a pagar e a receber,
-- definidos em Configurações → Lembretes. Lista vazia = o lembrete vai para
-- os Administradores e Tesoureiros ativos com e-mail cadastrado.
alter table public.loja_config
  add column emails_lembrete_contas text[] not null default '{}';
