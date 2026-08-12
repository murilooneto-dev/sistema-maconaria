import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { CATEGORIA_CAMPANHA_ID } from '@/lib/financeiro/constantes'

export type NovaMovimentacaoDoacao = {
  doacaoId: string
  campanhaId: string
  membroId: string | null
  contaId: string
  formaPagamentoId: string
  valor: number
  data: string
  usuarioId: string
}

/** Cria a movimentação ENTRADA/Campanha vinculada a uma doação recém-registrada. */
export async function criarMovimentacaoDoacao(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  input: NovaMovimentacaoDoacao
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin.from('movimentacoes').insert({
    data: input.data,
    tipo: 'ENTRADA',
    categoria_id: CATEGORIA_CAMPANHA_ID,
    descricao: 'Doação para campanha',
    valor: input.valor,
    conta_id: input.contaId,
    forma_pagamento_id: input.formaPagamentoId,
    membro_id: input.membroId,
    campanha_id: input.campanhaId,
    usuario_id: input.usuarioId,
    origem: 'CAMPANHA',
    doacao_id: input.doacaoId,
  })

  if (error) {
    return { error: error.message }
  }
  return {}
}

/** Cancela a movimentação vinculada a uma doação cancelada. */
export async function cancelarMovimentacaoDoacao(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  doacaoId: string,
  motivo: string,
  usuarioId: string
): Promise<{ error?: string }> {
  const { data: movimentacao } = await supabaseAdmin
    .from('movimentacoes')
    .select('id, status')
    .eq('doacao_id', doacaoId)
    .eq('status', 'ATIVO')
    .maybeSingle()

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
