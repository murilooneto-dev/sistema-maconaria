'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarMovimentacao, podeEditarMovimentacao } from '@/lib/domain/financeiro'
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
  revalidatePath('/financeiro/movimentacoes')

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
  revalidatePath('/financeiro/movimentacoes')
  return {}
}

export async function editarMovimentacao(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const movimentacaoId = String(formData.get('movimentacaoId') ?? '')
  const data = String(formData.get('data') ?? '')
  const tipo = String(formData.get('tipo') ?? '')
  const categoriaId = String(formData.get('categoriaId') ?? '')
  const descricao = String(formData.get('descricao') ?? '').trim()
  const valor = Number(formData.get('valor'))
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const membroId = String(formData.get('membroId') ?? '') || null
  const observacao = String(formData.get('observacao') ?? '').trim() || null
  const motivoEdicao = String(formData.get('motivoEdicao') ?? '').trim()

  if (!movimentacaoId) {
    return { error: 'Movimentação inválida.' }
  }
  if (motivoEdicao.length === 0) {
    return { error: 'Informe o motivo da edição.' }
  }

  const validacao = validarMovimentacao({ data, tipo, categoriaId, valor, contaId, formaPagamentoId })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: antiga, error: antigaError } = await supabaseAdmin
    .from('movimentacoes')
    .select('id, status, origem, data, tipo, categoria_id, descricao, valor, conta_id, forma_pagamento_id, membro_id, observacao')
    .eq('id', movimentacaoId)
    .single()

  if (antigaError || !antiga) {
    return { error: 'Movimentação não encontrada.' }
  }

  const editavel = podeEditarMovimentacao({ status: antiga.status, origem: antiga.origem })
  if (!editavel.valido) {
    return { error: editavel.erro }
  }

  if (await periodoEstaFechado(supabaseAdmin, antiga.data)) {
    return { error: 'Não é possível editar: o período desta movimentação já está fechado.' }
  }

  const { data: categoria } = await supabaseAdmin
    .from('categorias_movimentacao')
    .select('id, tipo, sistema, ativo')
    .eq('id', categoriaId)
    .single()

  if (!categoria || categoria.tipo !== tipo || categoria.sistema || !categoria.ativo) {
    return { error: 'Categoria inválida para este tipo de lançamento.' }
  }

  const { data: nova, error: novaError } = await supabaseAdmin
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
      editada_de_id: antiga.id,
    })
    .select('id')
    .single()

  if (novaError || !nova) {
    return { error: `Falha ao registrar movimentação corrigida: ${novaError?.message ?? 'erro desconhecido'}` }
  }

  const { data: canceladaAntiga, error: cancelarError } = await supabaseAdmin
    .from('movimentacoes')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: `Editada — substituída pela movimentação ${nova.id}. Motivo: ${motivoEdicao}`,
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', antiga.id)
    .eq('status', 'ATIVO')
    .select('id')
    .maybeSingle()

  if (cancelarError) {
    // Erro real do Postgres (ex.: trigger de período fechado, constraint, etc.)
    console.error(`Falha ao cancelar a movimentação ${antiga.id} durante edição: ${cancelarError.message}`)
    // Tenta desfazer a nova movimentação criada
    const { error: deleteError } = await supabaseAdmin.from('movimentacoes').delete().eq('id', nova.id)
    if (deleteError) {
      console.error(
        `Falha ao desfazer a movimentação ${nova.id} após não conseguir cancelar a movimentação ${antiga.id} — requer correção manual imediata (pode haver duas movimentações ATIVO para o mesmo lançamento).`
      )
      return {
        error: `Falha ao editar a movimentação. Contate o suporte para conferência manual (movimentações ${antiga.id} e ${nova.id}).`,
      }
    }
    return { error: 'Falha ao processar a edição. Tente novamente.' }
  }

  if (!canceladaAntiga) {
    // Compensa: a antiga não pôde ser cancelada por concorrência (outro usuário/thread a alterou) —
    // remove a nova pra não deixar duplicidade.
    const { error: deleteError } = await supabaseAdmin.from('movimentacoes').delete().eq('id', nova.id)
    if (deleteError) {
      console.error(
        `Falha ao desfazer a movimentação ${nova.id} após não conseguir cancelar a movimentação ${antiga.id} — requer correção manual imediata (pode haver duas movimentações ATIVO para o mesmo lançamento).`
      )
      return {
        error: `Falha ao editar a movimentação. Contate o suporte para conferência manual (movimentações ${antiga.id} e ${nova.id}).`,
      }
    }
    return { error: 'Esta movimentação foi alterada por outra operação simultânea. Tente novamente.' }
  }

  const dadosAnterioresAuditoria = {
    id: antiga.id,
    data: antiga.data,
    tipo: antiga.tipo,
    categoriaId: antiga.categoria_id,
    descricao: antiga.descricao,
    valor: Number(antiga.valor),
    contaId: antiga.conta_id,
    formaPagamentoId: antiga.forma_pagamento_id,
    membroId: antiga.membro_id,
    observacao: antiga.observacao,
    origem: antiga.origem,
  }
  const dadosNovosAuditoria = {
    movimentacaoAntigaId: antiga.id,
    movimentacaoNovaId: nova.id,
    data,
    tipo,
    categoriaId,
    descricao,
    valor,
    contaId,
    formaPagamentoId,
    membroId,
    observacao,
    motivoEdicao,
  }
  const descricaoAuditoria = `Edição da movimentação ${antiga.id} (substituída por ${nova.id})`

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'EDICAO_MOVIMENTACAO',
      registroTabela: 'movimentacoes',
      registroId: nova.id,
      dadosAnteriores: dadosAnterioresAuditoria,
      dadosNovos: dadosNovosAuditoria,
      descricao: descricaoAuditoria,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (movimentação editada com sucesso) — registroId nova.id:', auditError)
  }

  // Segunda entrada de auditoria com registroId = id da movimentação antiga, para
  // que uma busca por "o que aconteceu com a movimentação X" usando o id antigo
  // (o que foi cancelado) encontre o registro — o índice de auditoria é por
  // (registro_tabela, registro_id), e o id antigo só existe dentro do jsonb
  // dados_anteriores da entrada acima.
  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'EDICAO_MOVIMENTACAO',
      registroTabela: 'movimentacoes',
      registroId: antiga.id,
      dadosAnteriores: dadosAnterioresAuditoria,
      dadosNovos: dadosNovosAuditoria,
      descricao: descricaoAuditoria,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (movimentação editada com sucesso) — registroId antiga.id:', auditError)
  }

  const { erros: errosAnexos } = await uploadAnexosDoFormulario(supabaseAdmin, formData, 'anexos', {
    entidadeTipo: 'MOVIMENTACAO',
    entidadeId: nova.id,
    enviadoPor: usuario.id,
  })

  revalidatePath('/financeiro')
  revalidatePath('/financeiro/movimentacoes')

  if (errosAnexos.length > 0) {
    console.error(`Falha ao anexar arquivo(s) na edição da movimentação ${nova.id}: ${errosAnexos.join(' ')}`)
  }

  // A movimentação antiga (cuja URL de edição o usuário está vendo) foi cancelada
  // como parte da edição — permanecer na mesma página faria podeEditarMovimentacao
  // barrar o acesso e mostrar um erro de "não pode ser editada" logo após o sucesso.
  redirect('/financeiro')
}
