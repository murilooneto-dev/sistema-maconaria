-- config_mensalidade é histórico financeiro append-only: alterar uma
-- configuração futura nunca pode mudar valores históricos já vigentes
-- (CLAUDE.md §5/§6). A garantia até aqui era só via RLS, que toda Server
-- Action ignora ao usar o client service_role. Este trigger bloqueia
-- UPDATE/DELETE independentemente da role usada na conexão, fechando essa
-- lacuna para qualquer código futuro que também use service_role
-- (review final da Fase 4, item 4).
create function public.config_mensalidade_bloqueia_update_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'config_mensalidade é append-only (histórico financeiro) — nunca editar ou apagar uma versão existente, apenas inserir uma nova';
end;
$$;

create trigger config_mensalidade_no_update
  before update on public.config_mensalidade
  for each row execute function public.config_mensalidade_bloqueia_update_delete();

create trigger config_mensalidade_no_delete
  before delete on public.config_mensalidade
  for each row execute function public.config_mensalidade_bloqueia_update_delete();
