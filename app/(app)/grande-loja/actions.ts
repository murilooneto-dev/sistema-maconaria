'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { calcularTotal, validarSelecaoRepasse, MOTIVO_JA_REPASSADO } from '@/lib/domain/grande-loja'
import { criarMovimentacaoRepasse, cancelarMovimentacaoRepasse } from '@/lib/financeiro/movimentacao-repasse'
import { formatarMoedaBR } from '@/lib/format'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function marcarComoEnviado(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const itemIds = formData.getAll('itemId').map(String)
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const dataEnvio = String(formData.get('dataEnvio') ?? '')
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  const validacao = validarSelecaoRepasse({ itemIds, contaId, dataEnvio })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }
  if (!formaPagamentoId) {
    return { error: 'Selecione a forma de pagamento.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  // Leitura autoritativa no momento do envio — itemIds do formulário só
  // servem de filtro; o que realmente compõe o repasse é o que ainda está
  // PENDENTE e sem repasse_id agora, evitando enviar duas vezes um item já
  // pego por outra operação concorrente.
  const { data: itens, error: itensError } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .select('id, valor')
    .in('id', itemIds)
    .eq('status', 'PENDENTE')
    .is('repasse_id', null)

  if (itensError || !itens) {
    return { error: `Falha ao carregar itens: ${itensError?.message ?? 'erro desconhecido'}` }
  }

  if (itens.length !== itemIds.length) {
    return {
      error: 'Um ou mais itens selecionados não estão mais disponíveis (podem já ter sido enviados ou cancelados). Atualize a página e tente novamente.',
    }
  }

  const valorTotal = calcularTotal(itens)

  const { data: repasse, error: repasseError } = await supabaseAdmin
    .from('repasses_grande_loja')
    .insert({
      data_envio: dataEnvio,
      usuario_id: usuario.id,
      valor_total: valorTotal,
      observacao,
      conta_id: contaId,
    })
    .select('id')
    .single()

  if (repasseError || !repasse) {
    return { error: `Falha ao registrar repasse: ${repasseError?.message ?? 'erro desconhecido'}` }
  }

  const movimentacaoResult = await criarMovimentacaoRepasse(supabaseAdmin, {
    repasseId: repasse.id,
    contaId,
    formaPagamentoId,
    valor: valorTotal,
    data: dataEnvio,
    usuarioId: usuario.id,
  })

  if (movimentacaoResult.error) {
    await supabaseAdmin.from('repasses_grande_loja').update({ status: 'CANCELADO' }).eq('id', repasse.id)
    return {
      error: `Falha ao registrar movimentação financeira: ${movimentacaoResult.error}. O repasse foi cancelado automaticamente.`,
    }
  }

  const { data: atualizados, error: updateError } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .update({ repasse_id: repasse.id, status: 'ENVIADO' })
    .in(
      'id',
      itens.map((i) => i.id)
    )
    .eq('status', 'PENDENTE')
    .is('repasse_id', null)
    .select('id')

  if (updateError || !atualizados || atualizados.length !== itens.length) {
    console.error(
      `Repasse ${repasse.id}: nem todos os itens foram vinculados corretamente (${atualizados?.length ?? 0}/${itens.length}). Requer conferência manual.`
    )
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'grande-loja',
      acao: 'REPASSE_ENVIADO',
      registroTabela: 'repasses_grande_loja',
      registroId: repasse.id,
      dadosNovos: { itens: itens.length, valorTotal, contaId, dataEnvio },
      descricao: `Repasse de ${itens.length} item(ns) à Grande Loja, valor ${formatarMoedaBR(valorTotal)}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (repasse registrado com sucesso):', auditError)
  }

  revalidatePath('/grande-loja')
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/movimentacoes')
  return { success: 'Repasse registrado com sucesso.' }
}

/**
 * Marca itens PENDENTES (sem repasse) como já repassados à Grande Loja fora
 * do sistema — ex: competência quitada antes do controle atual existir.
 * Tira o item do cálculo de repasse atual e de qualquer futuro, sem gerar
 * um repasse de fato (não há movimentação financeira envolvida). Reversível
 * via `reverterItemJaRepassado`.
 */
export async function marcarItensComoJaRepassados(itemIds: string[]): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (itemIds.length === 0) {
    return { error: 'Selecione ao menos um mês.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: atualizados, error } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .update({
      status: 'CANCELADO',
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: MOTIVO_JA_REPASSADO,
    })
    .in('id', itemIds)
    .eq('status', 'PENDENTE')
    .is('repasse_id', null)
    .select('id')

  if (error) {
    return { error: `Falha ao marcar itens como já repassados: ${error.message}` }
  }

  if (!atualizados || atualizados.length !== itemIds.length) {
    return {
      error: 'Um ou mais itens selecionados não estão mais disponíveis (podem já ter sido enviados ou marcados). Atualize a página e tente novamente.',
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'grande-loja',
      acao: 'MARCACAO_MANUAL_JA_REPASSADO',
      registroTabela: 'repasses_grande_loja_itens',
      dadosNovos: { itens: atualizados.map((i) => i.id) },
      descricao: `${atualizados.length} item(ns) marcado(s) manualmente como já repassados anteriormente`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (itens marcados com sucesso):', auditError)
  }

  revalidatePath('/grande-loja')
  return {}
}

/** Reverte um item marcado manualmente como já repassado, devolvendo-o para PENDENTE (reentra no cálculo). */
export async function reverterItemJaRepassado(itemId: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: item, error: itemError } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .select('id, mensalidade_id, mensalidades(valor_grande_loja)')
    .eq('id', itemId)
    .eq('status', 'CANCELADO')
    .eq('motivo_cancelamento', MOTIVO_JA_REPASSADO)
    .is('repasse_id', null)
    .maybeSingle()

  if (itemError || !item) {
    return { error: 'Item não encontrado ou não foi marcado manualmente como já repassado.' }
  }

  const mensalidade = Array.isArray(item.mensalidades) ? item.mensalidades[0] : item.mensalidades

  const { error } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .update({
      status: 'PENDENTE',
      valor: mensalidade?.valor_grande_loja,
      cancelado_por: null,
      cancelado_em: null,
      motivo_cancelamento: null,
    })
    .eq('id', itemId)

  if (error) {
    return { error: `Falha ao reverter item: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'grande-loja',
      acao: 'REVERSAO_MARCACAO_JA_REPASSADO',
      registroTabela: 'repasses_grande_loja_itens',
      registroId: itemId,
      descricao: 'Reversão de marcação manual de "já repassado" — item volta a compor o cálculo de repasse',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (item revertido com sucesso):', auditError)
  }

  revalidatePath('/grande-loja')
  return {}
}

export async function cancelarRepasse(repasseId: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: reivindicado, error: reivindicarError } = await supabaseAdmin
    .from('repasses_grande_loja')
    .update({ status: 'CANCELADO' })
    .eq('id', repasseId)
    .eq('status', 'ENVIADO')
    .select('id')
    .maybeSingle()

  if (reivindicarError || !reivindicado) {
    return { error: 'Este repasse já foi cancelado ou não foi encontrado.' }
  }

  const { error: itensError } = await supabaseAdmin
    .from('repasses_grande_loja_itens')
    .update({ repasse_id: null, status: 'PENDENTE' })
    .eq('repasse_id', repasseId)
    .eq('status', 'ENVIADO')

  if (itensError) {
    console.error(`Falha ao reabrir itens do repasse ${repasseId} cancelado:`, itensError.message)
  }

  const movimentacaoResult = await cancelarMovimentacaoRepasse(supabaseAdmin, repasseId, usuario.id)
  if (movimentacaoResult.error) {
    console.error(`Falha ao cancelar a movimentação vinculada ao repasse ${repasseId}:`, movimentacaoResult.error)
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'grande-loja',
      acao: 'CANCELAMENTO_REPASSE',
      registroTabela: 'repasses_grande_loja',
      registroId: repasseId,
      descricao: `Cancelamento do repasse ${repasseId} — itens voltam a ficar PENDENTES`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (repasse cancelado com sucesso):', auditError)
  }

  revalidatePath('/grande-loja')
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/movimentacoes')
  return {}
}
