import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'

/**
 * Mantém `repasses_grande_loja_itens` em sincronia com o status da
 * mensalidade (SPEC §15): toda competência QUITADA passa a compor o
 * conjunto de valores de Grande Loja pendentes de envio; se o pagamento
 * que a quitou for revertido, o item volta a ficar de fora — mas só
 * enquanto ainda estiver PENDENTE (repasse_id null). Um item já ENVIADO
 * (dinheiro fisicamente repassado) não é revertido automaticamente — exige
 * conferência manual, documentado como limitação conhecida.
 *
 * Chamado tanto ao registrar quanto ao cancelar pagamento de mensalidade
 * (Fase 6). Non-fatal: falha aqui não deve derrubar o registro/cancelamento
 * do pagamento em si — só a rastreabilidade de Grande Loja fica pendente de
 * conferência manual, o que é recuperável pela tela /grande-loja depois.
 */
export async function sincronizarItemGrandeLoja(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  mensalidadeId: string
): Promise<void> {
  const { data: mensalidade } = await supabaseAdmin
    .from('mensalidades')
    .select('id, status, valor_grande_loja')
    .eq('id', mensalidadeId)
    .single()

  if (!mensalidade) {
    return
  }

  const { data: item } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .select('id, status, repasse_id')
    .eq('mensalidade_id', mensalidadeId)
    .maybeSingle()

  if (mensalidade.status === 'QUITADA') {
    if (!item) {
      await supabaseAdmin.from('repasses_grande_loja_itens').insert({
        mensalidade_id: mensalidadeId,
        valor: mensalidade.valor_grande_loja,
        status: 'PENDENTE',
      })
      return
    }
    if (item.status === 'CANCELADO' && !item.repasse_id) {
      await supabaseAdmin
        .from('repasses_grande_loja_itens')
        .update({ status: 'PENDENTE', valor: mensalidade.valor_grande_loja })
        .eq('id', item.id)
    }
    return
  }

  // Mensalidade não está mais QUITADA (pagamento revertido/cancelado).
  if (item && item.status === 'PENDENTE' && !item.repasse_id) {
    await supabaseAdmin.from('repasses_grande_loja_itens').update({ status: 'CANCELADO' }).eq('id', item.id)
  }
}
