import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { CATEGORIA_MENSALIDADE_ID } from '@/lib/financeiro/constantes'

export type NovaMovimentacaoPagamento = {
  pagamentoId: string
  membroId: string
  contaId: string
  formaPagamentoId: string
  valor: number
  data: string
  usuarioId: string
}

/** Cria a movimentação ENTRADA/Mensalidade vinculada a um pagamento de mensalidade recém-registrado. */
export async function criarMovimentacaoPagamento(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  input: NovaMovimentacaoPagamento
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.from('movimentacoes').insert({
    data: input.data,
    tipo: 'ENTRADA',
    categoria_id: CATEGORIA_MENSALIDADE_ID,
    descricao: 'Pagamento de mensalidade',
    valor: input.valor,
    conta_id: input.contaId,
    forma_pagamento_id: input.formaPagamentoId,
    membro_id: input.membroId,
    usuario_id: input.usuarioId,
    origem: 'MENSALIDADE',
    pagamento_id: input.pagamentoId,
  })

  if (error) {
    return { error: error.message }
  }
  return {}
}

/** Cancela a movimentação vinculada a um pagamento de mensalidade cancelado. */
export async function cancelarMovimentacaoPagamento(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  pagamentoId: string,
  motivo: string,
  usuarioId: string
): Promise<{ error?: string }> {
  const { data: movimentacao } = await supabaseAdmin
    .from('movimentacoes')
    .select('id, status')
    .eq('pagamento_id', pagamentoId)
    .eq('status', 'ATIVO')
    .maybeSingle()

  // Pagamentos registrados antes da Fase 7 não têm movimentação vinculada — nada a cancelar.
  if (!movimentacao) {
    return {}
  }

  const { error } = await supabaseAdmin
    .from('movimentacoes')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: motivo,
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
