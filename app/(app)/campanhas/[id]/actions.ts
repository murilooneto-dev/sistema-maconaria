'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarDoacao } from '@/lib/domain/campanhas'
import { criarMovimentacaoDoacao, cancelarMovimentacaoDoacao } from '@/lib/financeiro/movimentacao-doacao'
import { recalcularStatusCampanha } from '@/lib/campanhas/recalcular-status'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function registrarDoacao(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const campanhaId = String(formData.get('campanhaId') ?? '')
  const doador = String(formData.get('doador') ?? '').trim()
  const membroId = String(formData.get('membroId') ?? '') || null
  const valor = Number(formData.get('valor'))
  const data = String(formData.get('data') ?? '')
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  const validacao = validarDoacao({ doador, valor, data, contaId, formaPagamentoId })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: campanha } = await supabaseAdmin
    .from('campanhas')
    .select('id, status')
    .eq('id', campanhaId)
    .single()

  if (!campanha) {
    return { error: 'Campanha não encontrada.' }
  }
  if (campanha.status !== 'EM_ANDAMENTO') {
    return { error: 'Só é possível registrar doações em campanhas em andamento.' }
  }

  const { data: doacao, error } = await supabaseAdmin
    .from('doacoes')
    .insert({
      campanha_id: campanhaId,
      doador,
      membro_id: membroId,
      valor,
      data,
      conta_id: contaId,
      forma_pagamento_id: formaPagamentoId,
      observacao,
      usuario_id: usuario.id,
    })
    .select('id')
    .single()

  if (error || !doacao) {
    return { error: `Falha ao registrar doação: ${error?.message ?? 'erro desconhecido'}` }
  }

  const movimentacaoResult = await criarMovimentacaoDoacao(supabaseAdmin, {
    doacaoId: doacao.id,
    campanhaId,
    membroId,
    contaId,
    formaPagamentoId,
    valor,
    data,
    usuarioId: usuario.id,
  })

  if (movimentacaoResult.error) {
    // Compensa: cancela a doação recém-criada, já que a movimentação vinculada falhou.
    await supabaseAdmin
      .from('doacoes')
      .update({
        status: 'CANCELADO',
        motivo_cancelamento: 'Cancelado automaticamente: falha ao registrar a movimentação financeira.',
        cancelado_por: usuario.id,
        cancelado_em: new Date().toISOString(),
      })
      .eq('id', doacao.id)
    return {
      error: `Falha ao registrar movimentação financeira: ${movimentacaoResult.error}. A doação foi cancelada automaticamente.`,
    }
  }

  await recalcularStatusCampanha(supabaseAdmin, campanhaId)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'campanhas',
      acao: 'DOACAO',
      registroTabela: 'doacoes',
      registroId: doacao.id,
      dadosNovos: { campanhaId, doador, valor, data },
      descricao: `Doação de ${doador} para a campanha ${campanhaId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (doação registrada com sucesso):', auditError)
  }

  revalidatePath(`/campanhas/${campanhaId}`)
  revalidatePath('/campanhas')
  revalidatePath('/financeiro')
  return { success: 'Doação registrada com sucesso.' }
}

export async function cancelarDoacao(doacaoId: string, motivo: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (motivo.trim().length === 0) {
    return { error: 'Informe o motivo do cancelamento.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: doacao, error: doacaoError } = await supabaseAdmin
    .from('doacoes')
    .select('id, campanha_id, status')
    .eq('id', doacaoId)
    .single()

  if (doacaoError || !doacao) {
    return { error: 'Doação não encontrada.' }
  }

  if (doacao.status === 'CANCELADO') {
    return { error: 'Esta doação já está cancelada.' }
  }

  const { data: reivindicada, error: reivindicarError } = await supabaseAdmin
    .from('doacoes')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: motivo.trim(),
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', doacaoId)
    .eq('status', 'ATIVO')
    .select('id')
    .maybeSingle()

  if (reivindicarError || !reivindicada) {
    return { error: 'Esta doação já foi cancelada ou não foi encontrada.' }
  }

  const movimentacaoResult = await cancelarMovimentacaoDoacao(supabaseAdmin, doacaoId, motivo.trim(), usuario.id)
  if (movimentacaoResult.error) {
    console.error(
      `Falha ao cancelar a movimentação vinculada à doação ${doacaoId}: ${movimentacaoResult.error}. Requer conferência manual.`
    )
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'campanhas',
      acao: 'CANCELAMENTO_DOACAO',
      registroTabela: 'doacoes',
      registroId: doacaoId,
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Cancelamento da doação ${doacaoId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (doação cancelada com sucesso):', auditError)
  }

  revalidatePath(`/campanhas/${doacao.campanha_id}`)
  revalidatePath('/campanhas')
  revalidatePath('/financeiro')
  return {}
}
