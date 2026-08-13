'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarMovimentacao } from '@/lib/domain/financeiro'
import { periodoEstaFechado } from '@/lib/financeiro/periodo'
import { uploadAnexosDoFormulario } from '@/lib/anexos/upload'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function registrarMovimentacao(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const data = String(formData.get('data') ?? '')
  const tipo = String(formData.get('tipo') ?? '')
  const categoriaId = String(formData.get('categoriaId') ?? '')
  const descricao = String(formData.get('descricao') ?? '').trim()
  const valor = Number(formData.get('valor'))
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const membroId = String(formData.get('membroId') ?? '') || null
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  const validacao = validarMovimentacao({ data, tipo, categoriaId, valor, contaId, formaPagamentoId })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: categoria } = await supabaseAdmin
    .from('categorias_movimentacao')
    .select('id, tipo, sistema, ativo')
    .eq('id', categoriaId)
    .single()

  if (!categoria || categoria.tipo !== tipo || categoria.sistema || !categoria.ativo) {
    return { error: 'Categoria inválida para este tipo de lançamento.' }
  }

  const { data: criada, error } = await supabaseAdmin
    .from('movimentacoes')
    .insert({
      data,
      tipo,
      categoria_id: categoriaId,
      descricao: descricao || null,
      valor,
      conta_id: contaId,
      forma_pagamento_id: formaPagamentoId,
      membro_id: membroId,
      usuario_id: usuario.id,
      origem: 'MANUAL',
      observacao,
    })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao registrar movimentação: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'CRIACAO_MOVIMENTACAO',
      registroTabela: 'movimentacoes',
      registroId: criada.id,
      dadosNovos: { data, tipo, categoriaId, valor, contaId, formaPagamentoId, membroId },
      descricao: `Lançamento manual de movimentação (${tipo})`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (movimentação criada com sucesso):', auditError)
  }

  // Anexos são um dado auxiliar do comprovante — falha no upload não desfaz
  // uma movimentação já registrada e confirmada com sucesso, só vira aviso.
  const { erros: errosAnexos } = await uploadAnexosDoFormulario(supabaseAdmin, formData, 'anexos', {
    entidadeTipo: 'MOVIMENTACAO',
    entidadeId: criada.id,
    enviadoPor: usuario.id,
  })

  revalidatePath('/financeiro')

  if (errosAnexos.length > 0) {
    return { success: `Movimentação registrada com sucesso. Falha ao anexar arquivo(s): ${errosAnexos.join(' ')}` }
  }
  return { success: 'Movimentação registrada com sucesso.' }
}

export async function cancelarMovimentacao(id: string, motivo: string): Promise<{ error?: string }> {
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

  const { data: movimentacao, error: movimentacaoError } = await supabaseAdmin
    .from('movimentacoes')
    .select('id, status, origem, data')
    .eq('id', id)
    .single()

  if (movimentacaoError || !movimentacao) {
    return { error: 'Movimentação não encontrada.' }
  }

  if (movimentacao.status === 'CANCELADO') {
    return { error: 'Esta movimentação já está cancelada.' }
  }

  if (movimentacao.origem === 'MENSALIDADE') {
    return {
      error: 'Esta movimentação é gerada automaticamente por um pagamento de mensalidade — cancele o pagamento na tela de Mensalidades.',
    }
  }

  if (await periodoEstaFechado(supabaseAdmin, movimentacao.data)) {
    return { error: 'Não é possível cancelar: o período desta movimentação já está fechado.' }
  }

  const { data: atualizada, error } = await supabaseAdmin
    .from('movimentacoes')
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
    return { error: `Falha ao cancelar movimentação: ${error?.message ?? 'já cancelada por outra operação'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'CANCELAMENTO_MOVIMENTACAO',
      registroTabela: 'movimentacoes',
      registroId: id,
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Cancelamento da movimentação ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (movimentação cancelada com sucesso):', auditError)
  }

  revalidatePath('/financeiro')
  return {}
}
