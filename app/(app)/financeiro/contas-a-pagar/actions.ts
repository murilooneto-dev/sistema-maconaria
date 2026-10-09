'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { periodoEstaFechado } from '@/lib/financeiro/periodo'
import {
  gerarVencimentosRecorrentes,
  tipoMovimentacaoDaConta,
  validarBaixa,
  validarNovaConta,
  type TipoConta,
} from '@/lib/domain/contas-pagar-receber'

type ActionState = { error: string } | { success: string } | undefined

const ORIGEM_MOVIMENTACAO = 'CONTA_PAGAR_RECEBER'

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

function revalidar() {
  revalidatePath('/financeiro/contas-a-pagar')
  revalidatePath('/financeiro')
  revalidatePath('/financeiro/movimentacoes')
}

export async function criarConta(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const tipo = String(formData.get('tipo') ?? '')
  const nome = String(formData.get('nome') ?? '').trim()
  const valor = Number(formData.get('valor'))
  const dataVencimento = String(formData.get('dataVencimento') ?? '')
  const recorrente = formData.get('recorrente') === 'on'
  const meses = Number(formData.get('meses'))
  const observacao = String(formData.get('observacao') ?? '').trim() || null

  const validacao = validarNovaConta({ tipo, nome, valor, dataVencimento, recorrente, meses })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const base = { tipo, nome, valor, observacao, usuario_id: usuario.id }
  const recorrenciaId = recorrente ? randomUUID() : null
  const linhas = recorrente
    ? gerarVencimentosRecorrentes(dataVencimento, meses).map((vencimento, indice) => ({
        ...base,
        data_vencimento: vencimento,
        recorrencia_id: recorrenciaId,
        parcela: indice + 1,
        total_parcelas: meses,
      }))
    : [{ ...base, data_vencimento: dataVencimento }]

  const supabaseAdmin = createSupabaseServiceRoleClient()
  // Um único insert: ou todas as parcelas são criadas, ou nenhuma.
  const { data: criadas, error } = await supabaseAdmin.from('contas_pagar_receber').insert(linhas).select('id')

  if (error || !criadas) {
    return { error: `Falha ao criar conta: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'CRIACAO_CONTA_PAGAR_RECEBER',
      registroTabela: 'contas_pagar_receber',
      registroId: criadas[0].id,
      dadosNovos: { tipo, nome, valor, dataVencimento, recorrente, meses: recorrente ? meses : null, recorrenciaId },
      descricao: `Conta a ${tipo === 'PAGAR' ? 'pagar' : 'receber'} "${nome}" criada${
        recorrente ? ` (recorrente, ${meses} parcelas mensais)` : ''
      }`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (conta criada com sucesso):', auditError)
  }

  revalidar()
  return {
    success: recorrente ? `${criadas.length} parcelas criadas com sucesso.` : 'Conta criada com sucesso.',
  }
}

/**
 * Dá baixa numa conta ABERTA: marca como BAIXADA e cria a movimentação
 * correspondente no Financeiro (SAIDA para conta a pagar, ENTRADA para a
 * receber). É a movimentação que entra nos saldos — a conta em si não.
 */
export async function baixarConta(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const id = String(formData.get('contaPagarReceberId') ?? '')
  const dataBaixa = String(formData.get('dataBaixa') ?? '')
  const valorBaixa = Number(formData.get('valorBaixa'))
  const contaId = String(formData.get('contaId') ?? '')
  const formaPagamentoId = String(formData.get('formaPagamentoId') ?? '')
  const categoriaId = String(formData.get('categoriaId') ?? '')

  const validacao = validarBaixa({ dataBaixa, valorBaixa, contaId, formaPagamentoId, categoriaId })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: conta } = await supabaseAdmin
    .from('contas_pagar_receber')
    .select('id, tipo, nome, valor, status, parcela, total_parcelas')
    .eq('id', id)
    .maybeSingle()

  if (!conta) {
    return { error: 'Conta não encontrada.' }
  }
  if (conta.status !== 'ABERTA') {
    return { error: 'Esta conta já foi baixada ou cancelada.' }
  }

  const tipoMovimentacao = tipoMovimentacaoDaConta(conta.tipo as TipoConta)

  const { data: categoria } = await supabaseAdmin
    .from('categorias_movimentacao')
    .select('id, tipo, sistema, ativo')
    .eq('id', categoriaId)
    .maybeSingle()

  if (!categoria || categoria.tipo !== tipoMovimentacao || categoria.sistema || !categoria.ativo) {
    return { error: 'Categoria inválida para este tipo de conta.' }
  }

  // Reivindica a baixa antes de criar a movimentação: se dois operadores
  // derem baixa na mesma conta ao mesmo tempo, só um passa daqui, e nunca
  // são criadas duas movimentações para a mesma conta.
  const { data: reivindicada, error: reivindicarError } = await supabaseAdmin
    .from('contas_pagar_receber')
    .update({
      status: 'BAIXADA',
      data_baixa: dataBaixa,
      valor_baixa: valorBaixa,
      baixado_por: usuario.id,
      baixado_em: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'ABERTA')
    .select('id')
    .maybeSingle()

  if (reivindicarError || !reivindicada) {
    return {
      error: reivindicarError
        ? `Falha ao dar baixa: ${reivindicarError.message}`
        : 'Esta conta já foi baixada ou cancelada por outra operação.',
    }
  }

  const descricao = conta.parcela ? `${conta.nome} (${conta.parcela}/${conta.total_parcelas})` : conta.nome

  const { data: movimentacao, error: movimentacaoError } = await supabaseAdmin
    .from('movimentacoes')
    .insert({
      data: dataBaixa,
      tipo: tipoMovimentacao,
      categoria_id: categoriaId,
      descricao,
      valor: valorBaixa,
      conta_id: contaId,
      forma_pagamento_id: formaPagamentoId,
      usuario_id: usuario.id,
      origem: ORIGEM_MOVIMENTACAO,
    })
    .select('id')
    .single()

  const reabrir = {
    status: 'ABERTA',
    data_baixa: null,
    valor_baixa: null,
    movimentacao_id: null,
    baixado_por: null,
    baixado_em: null,
  }

  if (movimentacaoError || !movimentacao) {
    const { error: reabrirError } = await supabaseAdmin.from('contas_pagar_receber').update(reabrir).eq('id', id)
    if (reabrirError) {
      console.error(
        `Conta ${id} ficou BAIXADA sem movimentação financeira e não pôde ser reaberta — requer correção manual: ${reabrirError.message}`
      )
      return {
        error: `Falha ao lançar no Financeiro e também ao reabrir a conta. Contate o suporte técnico (conta ${id}).`,
      }
    }
    return {
      error: `Falha ao lançar no Financeiro: ${movimentacaoError?.message ?? 'erro desconhecido'}. A conta continua em aberto.`,
    }
  }

  const { error: vinculoError } = await supabaseAdmin
    .from('contas_pagar_receber')
    .update({ movimentacao_id: movimentacao.id })
    .eq('id', id)

  if (vinculoError) {
    // Sem o vínculo o estorno não acharia a movimentação: desfaz tudo.
    await supabaseAdmin.from('movimentacoes').delete().eq('id', movimentacao.id)
    await supabaseAdmin.from('contas_pagar_receber').update(reabrir).eq('id', id)
    return { error: `Falha ao vincular a baixa ao Financeiro: ${vinculoError.message}. A conta continua em aberto.` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'BAIXA_CONTA_PAGAR_RECEBER',
      registroTabela: 'contas_pagar_receber',
      registroId: id,
      dadosAnteriores: { status: 'ABERTA', valor: Number(conta.valor) },
      dadosNovos: { dataBaixa, valorBaixa, contaId, formaPagamentoId, categoriaId, movimentacaoId: movimentacao.id },
      descricao: `Baixa da conta a ${conta.tipo === 'PAGAR' ? 'pagar' : 'receber'} "${descricao}"`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (baixa realizada com sucesso):', auditError)
  }

  revalidar()
  return { success: 'Baixa registrada e lançada no Financeiro.' }
}

/** Desfaz uma baixa: cancela a movimentação gerada e devolve a conta para ABERTA. */
export async function estornarBaixa(id: string, motivo: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (motivo.trim().length === 0) {
    return { error: 'Informe o motivo do estorno.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: conta } = await supabaseAdmin
    .from('contas_pagar_receber')
    .select('id, nome, status, data_baixa, valor_baixa, movimentacao_id')
    .eq('id', id)
    .maybeSingle()

  if (!conta || conta.status !== 'BAIXADA' || !conta.data_baixa) {
    return { error: 'Esta conta não está baixada.' }
  }

  // Checado antes de qualquer alteração: o banco recusa cancelar a
  // movimentação de um mês fechado, e a conta voltaria a ABERTA com o
  // lançamento ainda ativo no caixa.
  if (await periodoEstaFechado(supabaseAdmin, conta.data_baixa)) {
    return { error: 'Não é possível estornar: o período desta baixa já está fechado.' }
  }

  if (conta.movimentacao_id) {
    const { data: cancelada, error: cancelarError } = await supabaseAdmin
      .from('movimentacoes')
      .update({
        status: 'CANCELADO',
        motivo_cancelamento: `Estorno da baixa da conta "${conta.nome}". Motivo: ${motivo.trim()}`,
        cancelado_por: usuario.id,
        cancelado_em: new Date().toISOString(),
      })
      .eq('id', conta.movimentacao_id)
      .eq('status', 'ATIVO')
      .select('id')
      .maybeSingle()

    if (cancelarError || !cancelada) {
      return {
        error: `Falha ao cancelar o lançamento no Financeiro: ${cancelarError?.message ?? 'lançamento já cancelado'}. A baixa não foi estornada.`,
      }
    }
  }

  const { error } = await supabaseAdmin
    .from('contas_pagar_receber')
    .update({
      status: 'ABERTA',
      data_baixa: null,
      valor_baixa: null,
      movimentacao_id: null,
      baixado_por: null,
      baixado_em: null,
    })
    .eq('id', id)
    .eq('status', 'BAIXADA')

  if (error) {
    console.error(
      `Estorno incompleto da conta ${id}: a movimentação ${conta.movimentacao_id} foi cancelada mas a conta continua BAIXADA — requer correção manual: ${error.message}`
    )
    return {
      error: `O lançamento no Financeiro foi cancelado, mas a conta não voltou para em aberto. Contate o suporte técnico (conta ${id}).`,
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'ESTORNO_BAIXA_CONTA_PAGAR_RECEBER',
      registroTabela: 'contas_pagar_receber',
      registroId: id,
      dadosAnteriores: {
        dataBaixa: conta.data_baixa,
        valorBaixa: Number(conta.valor_baixa),
        movimentacaoId: conta.movimentacao_id,
      },
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Estorno da baixa da conta "${conta.nome}"`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (baixa estornada com sucesso):', auditError)
  }

  revalidar()
  return {}
}

/**
 * Cancela uma conta ABERTA. Com `incluirProximas`, cancela também as
 * parcelas seguintes ainda em aberto da mesma recorrência (ex.: contrato
 * encerrado antes do fim).
 */
export async function cancelarConta(
  id: string,
  motivo: string,
  incluirProximas: boolean
): Promise<{ error?: string; canceladas?: number }> {
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

  const { data: conta } = await supabaseAdmin
    .from('contas_pagar_receber')
    .select('id, nome, status, recorrencia_id, parcela')
    .eq('id', id)
    .maybeSingle()

  if (!conta) {
    return { error: 'Conta não encontrada.' }
  }
  if (conta.status !== 'ABERTA') {
    return { error: 'Só é possível cancelar conta em aberto. Se já foi baixada, estorne a baixa antes.' }
  }

  const cancelamento = {
    status: 'CANCELADA',
    motivo_cancelamento: motivo.trim(),
    cancelado_por: usuario.id,
    cancelado_em: new Date().toISOString(),
  }

  const emSerie = incluirProximas && conta.recorrencia_id && conta.parcela
  const consulta = emSerie
    ? supabaseAdmin
        .from('contas_pagar_receber')
        .update(cancelamento)
        .eq('recorrencia_id', conta.recorrencia_id)
        .gte('parcela', conta.parcela)
    : supabaseAdmin.from('contas_pagar_receber').update(cancelamento).eq('id', id)

  const { data: canceladas, error } = await consulta.eq('status', 'ABERTA').select('id')

  if (error || !canceladas || canceladas.length === 0) {
    return { error: `Falha ao cancelar conta: ${error?.message ?? 'já alterada por outra operação'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'CANCELAMENTO_CONTA_PAGAR_RECEBER',
      registroTabela: 'contas_pagar_receber',
      registroId: id,
      dadosNovos: { motivo: motivo.trim(), contasCanceladas: canceladas.map((c) => c.id) },
      descricao: `Cancelamento da conta "${conta.nome}"${
        canceladas.length > 1 ? ` e das parcelas seguintes (${canceladas.length} no total)` : ''
      }`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (conta cancelada com sucesso):', auditError)
  }

  revalidar()
  return { canceladas: canceladas.length }
}
