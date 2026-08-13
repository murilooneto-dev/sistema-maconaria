import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Quando um membro muda de remido/normal, as competências ainda PENDENTES
 * (nada pago) passam a usar o valor da configuração vigente do novo tipo —
 * decisão do usuário (2026-08-13): "se um membro for marcado como REMIDO,
 * todas as mensalidades dele devem mudar automaticamente para o valor
 * configurado".
 *
 * Escopo deliberadamente restrito a `status = 'PENDENTE'`: uma competência
 * PARCIAL ou QUITADA já tem `valor_pago` registrado, e a constraint
 * `valor_pago <= valor_devido` rejeitaria (ou distorceria o rateio já
 * histórico) qualquer redução de valor sobre ela — preserva a regra de
 * ouro de imutabilidade histórica (CLAUDE.md §5) mesmo dentro desta
 * atualização em lote.
 */
export async function sincronizarValorMensalidadesPendentes(
  supabaseAdmin: SupabaseClient,
  membroId: string,
  remido: boolean
): Promise<number> {
  const { data: config } = await supabaseAdmin
    .from('config_mensalidade')
    .select('valor_mensalidade, valor_grande_loja, valor_loja')
    .eq('tipo', remido ? 'REMIDO' : 'NORMAL')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  if (!config) {
    return 0
  }

  const { data: atualizadas, error } = await supabaseAdmin
    .from('mensalidades')
    .update({
      valor_devido: config.valor_mensalidade,
      valor_grande_loja: config.valor_grande_loja,
      valor_loja: config.valor_loja,
    })
    .eq('membro_id', membroId)
    .eq('status', 'PENDENTE')
    .select('id')

  if (error) {
    throw new Error(`Falha ao sincronizar valor das mensalidades pendentes: ${error.message}`)
  }

  return atualizadas?.length ?? 0
}
