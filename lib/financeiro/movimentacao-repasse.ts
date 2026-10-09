import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { CATEGORIA_GRANDE_LOJA_ID } from '@/lib/financeiro/constantes'

export type NovaMovimentacaoRepasse = {
  repasseId: string
  contaId: string
  formaPagamentoId: string
  valor: number
  data: string
  usuarioId: string
}

/** Cria a movimentação SAIDA/Grande Loja vinculada a um repasse marcado como enviado. */
export async function criarMovimentacaoRepasse(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  input: NovaMovimentacaoRepasse
): Promise<{ error?: string; movimentacaoId?: string }> {
  const { data, error } = await supabaseAdmin
    .from('movimentacoes')
    .insert({
      data: input.data,
      tipo: 'SAIDA',
      categoria_id: CATEGORIA_GRANDE_LOJA_ID,
      descricao: 'Repasse à Grande Loja',
      valor: input.valor,
      conta_id: input.contaId,
      forma_pagamento_id: input.formaPagamentoId,
      usuario_id: input.usuarioId,
      origem: 'GRANDE_LOJA',
      repasse_grande_loja_id: input.repasseId,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { error: error?.message ?? 'erro desconhecido' }
  }
  return { movimentacaoId: data.id }
}

/** Cancela a movimentação vinculada a um repasse cancelado. */
export async function cancelarMovimentacaoRepasse(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  repasseId: string,
  motivo: string,
  usuarioId: string
): Promise<{ error?: string }> {
  const { data: movimentacao } = await supabaseAdmin
    .from('movimentacoes')
    .select('id, status')
    .eq('repasse_grande_loja_id', repasseId)
    .eq('status', 'ATIVO')
    .maybeSingle()

  if (!movimentacao) {
    return {}
  }

  const { error } = await supabaseAdmin
    .from('movimentacoes')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: `Repasse à Grande Loja cancelado. Motivo: ${motivo}`,
      cancelado_por: usuarioId,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', movimentacao.id)
    .eq('status', 'ATIVO')

  if (error) {
    return { error: error.message }
  }
  return {}
}
