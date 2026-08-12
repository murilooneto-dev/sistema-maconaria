'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarTransferencia } from '@/lib/domain/financeiro'
import { periodoEstaFechado } from '@/lib/financeiro/periodo'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function registrarTransferencia(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const contaOrigemId = String(formData.get('contaOrigemId') ?? '')
  const contaDestinoId = String(formData.get('contaDestinoId') ?? '')
  const valor = Number(formData.get('valor'))
  const data = String(formData.get('data') ?? '')
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  const validacao = validarTransferencia({ contaOrigemId, contaDestinoId, valor, data })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: criada, error } = await supabaseAdmin
    .from('transferencias')
    .insert({
      conta_origem_id: contaOrigemId,
      conta_destino_id: contaDestinoId,
      valor,
      data,
      observacao,
      usuario_id: usuario.id,
    })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao registrar transferência: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'CRIACAO_TRANSFERENCIA',
      registroTabela: 'transferencias',
      registroId: criada.id,
      dadosNovos: { contaOrigemId, contaDestinoId, valor, data },
      descricao: `Transferência de ${valor} entre contas`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (transferência criada com sucesso):', auditError)
  }

  revalidatePath('/financeiro/transferencias')
  return { success: 'Transferência registrada com sucesso.' }
}

export async function cancelarTransferencia(id: string, motivo: string): Promise<{ error?: string }> {
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

  const { data: transferencia, error: transferenciaError } = await supabaseAdmin
    .from('transferencias')
    .select('id, status, data')
    .eq('id', id)
    .single()

  if (transferenciaError || !transferencia) {
    return { error: 'Transferência não encontrada.' }
  }

  if (transferencia.status === 'CANCELADO') {
    return { error: 'Esta transferência já está cancelada.' }
  }

  if (await periodoEstaFechado(supabaseAdmin, transferencia.data)) {
    return { error: 'Não é possível cancelar: o período desta transferência já está fechado.' }
  }

  const { data: atualizada, error } = await supabaseAdmin
    .from('transferencias')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: motivo.trim(),
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'ATIVO')
    .select('id')
    .maybeSingle()

  if (error || !atualizada) {
    return {
      error: `Falha ao cancelar transferência: ${error?.message ?? 'já cancelada por outra operação'}`,
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'CANCELAMENTO_TRANSFERENCIA',
      registroTabela: 'transferencias',
      registroId: id,
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Cancelamento da transferência ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (transferência cancelada com sucesso):', auditError)
  }

  revalidatePath('/financeiro/transferencias')
  return {}
}
