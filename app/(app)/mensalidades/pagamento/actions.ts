'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import {
  calcularNovoStatusMensalidade,
  calcularValorTotal,
  validarAlocacoes,
  type AlocacaoCompetencia,
} from '@/lib/domain/pagamentos'
import { recalcularSituacaoMembro } from '@/lib/mensalidades/recalcular-situacao'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

/**
 * Arredonda um valor monetário para 2 casas decimais (centavos). Necessário
 * porque `saldo` vem do Supabase como `number` derivado de uma coluna
 * NUMERIC gerada no Postgres, e comparações de ponto flutuante contra
 * valores digitados no formulário podem sofrer ruído de arredondamento
 * (ex.: 150.00000000001 vs 150), rejeitando indevidamente um pagamento
 * legítimo em `validarAlocacoes`. Ver revisão da Tarefa 5.
 */
function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100
}

export async function registrarPagamento(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const membroId = String(formData.get('membroId') ?? '')
  const dataPagamento = String(formData.get('dataPagamento') ?? '')
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const observacao = String(formData.get('observacao') ?? '')

  if (!membroId || !dataPagamento || !contaId || !formaPagamentoId) {
    return { error: 'Preencha membro, data, conta e forma de pagamento.' }
  }

  const mensalidadeIds = formData.getAll('mensalidadeId').map(String)
  const alocacoes: AlocacaoCompetencia[] = mensalidadeIds
    .filter((id) => formData.get(`selecionada_${id}`) === 'on')
    .map((id) => ({
      mensalidadeId: id,
      valorAplicado: arredondarCentavos(Number(formData.get(`valorAplicado_${id}`))),
    }))

  const supabaseAdmin = createSupabaseServiceRoleClient()

  if (alocacoes.length === 0) {
    return { error: 'Selecione ao menos uma competência.' }
  }

  const { data: mensalidades, error: mensalidadesError } = await supabaseAdmin
    .from('mensalidades')
    .select('id, valor_devido, valor_pago, saldo')
    .in(
      'id',
      alocacoes.map((a) => a.mensalidadeId)
    )

  if (mensalidadesError || !mensalidades) {
    return {
      error: `Falha ao carregar competências: ${mensalidadesError?.message ?? 'erro desconhecido'}`,
    }
  }

  const validacao = validarAlocacoes(
    alocacoes,
    mensalidades.map((m) => ({ id: m.id, saldo: arredondarCentavos(m.saldo) }))
  )
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const valorTotal = calcularValorTotal(alocacoes)

  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from('pagamentos')
    .insert({
      membro_id: membroId,
      valor_total: valorTotal,
      data_pagamento: dataPagamento,
      conta_id: contaId,
      forma_pagamento_id: formaPagamentoId,
      usuario_id: usuario.id,
      observacao: observacao.trim() || null,
    })
    .select('id')
    .single()

  if (pagamentoError || !pagamento) {
    return {
      error: `Falha ao registrar pagamento: ${pagamentoError?.message ?? 'erro desconhecido'}`,
    }
  }

  for (const alocacao of alocacoes) {
    const mensalidade = mensalidades.find((m) => m.id === alocacao.mensalidadeId)
    if (!mensalidade) {
      continue
    }

    const { error: linkError } = await supabaseAdmin.from('pagamento_mensalidades').insert({
      pagamento_id: pagamento.id,
      mensalidade_id: alocacao.mensalidadeId,
      valor_aplicado: alocacao.valorAplicado,
    })

    if (linkError) {
      return { error: `Falha ao vincular competência ao pagamento: ${linkError.message}` }
    }

    const novoValorPago = arredondarCentavos(
      arredondarCentavos(mensalidade.valor_pago) + alocacao.valorAplicado
    )
    const novoStatus = calcularNovoStatusMensalidade(
      arredondarCentavos(mensalidade.valor_devido),
      novoValorPago
    )

    const { error: updateError } = await supabaseAdmin
      .from('mensalidades')
      .update({
        valor_pago: novoValorPago,
        status: novoStatus,
        data_quitacao: novoStatus === 'QUITADA' ? new Date().toISOString() : null,
      })
      .eq('id', alocacao.mensalidadeId)

    if (updateError) {
      return { error: `Falha ao atualizar competência: ${updateError.message}` }
    }
  }

  await recalcularSituacaoMembro(supabaseAdmin, membroId)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'PAGAMENTO',
      registroTabela: 'pagamentos',
      registroId: pagamento.id,
      dadosNovos: { membroId, valorTotal, alocacoes },
      descricao: `Pagamento de ${alocacoes.length} competência(s) do membro ${membroId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (pagamento registrado com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')
  revalidatePath('/mensalidades/pagamento')
  revalidatePath(`/membros/${membroId}`)
  return { success: 'Pagamento registrado com sucesso.' }
}

export async function cancelarPagamento(pagamentoId: string, motivo: string): Promise<{ error?: string }> {
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

  const { data: pagamento, error: pagamentoError } = await supabaseAdmin
    .from('pagamentos')
    .select('id, membro_id, status')
    .eq('id', pagamentoId)
    .single()

  if (pagamentoError || !pagamento) {
    return { error: 'Pagamento não encontrado.' }
  }

  if (pagamento.status === 'CANCELADO') {
    return { error: 'Este pagamento já está cancelado.' }
  }

  const { data: vinculos, error: vinculosError } = await supabaseAdmin
    .from('pagamento_mensalidades')
    .select('mensalidade_id, valor_aplicado')
    .eq('pagamento_id', pagamentoId)

  if (vinculosError || !vinculos) {
    return {
      error: `Falha ao carregar competências vinculadas: ${vinculosError?.message ?? 'erro desconhecido'}`,
    }
  }

  for (const vinculo of vinculos) {
    const { data: mensalidade } = await supabaseAdmin
      .from('mensalidades')
      .select('valor_devido, valor_pago')
      .eq('id', vinculo.mensalidade_id)
      .single()

    if (!mensalidade) {
      continue
    }

    const valorAplicado = arredondarCentavos(vinculo.valor_aplicado)
    const novoValorPago = Math.max(
      0,
      arredondarCentavos(arredondarCentavos(mensalidade.valor_pago) - valorAplicado)
    )
    const novoStatus =
      novoValorPago === 0
        ? 'PENDENTE'
        : calcularNovoStatusMensalidade(arredondarCentavos(mensalidade.valor_devido), novoValorPago)

    const updatePayload: Record<string, unknown> = { valor_pago: novoValorPago, status: novoStatus }
    if (novoStatus !== 'QUITADA') {
      updatePayload.data_quitacao = null
    }

    const { error: updateError } = await supabaseAdmin
      .from('mensalidades')
      .update(updatePayload)
      .eq('id', vinculo.mensalidade_id)

    if (updateError) {
      return { error: `Falha ao reverter competência: ${updateError.message}` }
    }
  }

  const { error: cancelError } = await supabaseAdmin
    .from('pagamentos')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: motivo.trim(),
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', pagamentoId)

  if (cancelError) {
    return { error: `Falha ao cancelar pagamento: ${cancelError.message}` }
  }

  await recalcularSituacaoMembro(supabaseAdmin, pagamento.membro_id)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'CANCELAMENTO_PAGAMENTO',
      registroTabela: 'pagamentos',
      registroId: pagamentoId,
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Cancelamento do pagamento ${pagamentoId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (pagamento cancelado com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')
  revalidatePath('/mensalidades/pagamento')
  revalidatePath(`/membros/${pagamento.membro_id}`)
  return {}
}
