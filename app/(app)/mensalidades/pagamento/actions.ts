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

type AlocacaoAplicada = {
  mensalidadeId: string
  valorAplicado: number
  valorDevidoAntes: number
  valorPagoAntes: number
}

/**
 * Compensa uma falha no meio do loop de aplicação de alocações em
 * `registrarPagamento`: reverte cada mensalidade já aplicada com sucesso
 * de volta ao valor_pago/status anteriores e cancela automaticamente o
 * pagamento (que já tem vínculos parciais e valor_total inflado). Corrige
 * C2 da revisão da Tarefa 5 — sem isso, uma falha parcial deixava um
 * pagamento ATIVO órfão, com valor_total cobrindo alocações que nunca
 * foram de fato aplicadas.
 */
async function compensarFalhaParcial(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  pagamentoId: string,
  aplicadas: AlocacaoAplicada[],
  usuarioId: string
): Promise<void> {
  for (const item of aplicadas) {
    const novoValorPago = arredondarCentavos(item.valorPagoAntes)
    const novoStatus =
      novoValorPago === 0
        ? 'PENDENTE'
        : calcularNovoStatusMensalidade(arredondarCentavos(item.valorDevidoAntes), novoValorPago)
    const payload: Record<string, unknown> = { valor_pago: novoValorPago, status: novoStatus }
    if (novoStatus !== 'QUITADA') {
      payload.data_quitacao = null
    }
    await supabaseAdmin.from('mensalidades').update(payload).eq('id', item.mensalidadeId)
  }

  await supabaseAdmin
    .from('pagamentos')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: 'Cancelado automaticamente: falha ao registrar todas as competências selecionadas.',
      cancelado_por: usuarioId,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', pagamentoId)
    .eq('status', 'ATIVO')
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

  // I3: deduplica por mensalidadeId — dois campos pro mesmo id (ex.: form
  // manipulado) passariam individualmente na validação de saldo mas juntos
  // poderiam exceder o saldo real da competência. Agrega antes de validar.
  const mensalidadeIds = formData.getAll('mensalidadeId').map(String)
  const alocacoesPorId = new Map<string, number>()
  for (const id of mensalidadeIds) {
    if (formData.get(`selecionada_${id}`) !== 'on') {
      continue
    }
    const valor = arredondarCentavos(Number(formData.get(`valorAplicado_${id}`)))
    alocacoesPorId.set(id, arredondarCentavos((alocacoesPorId.get(id) ?? 0) + valor))
  }
  const alocacoes: AlocacaoCompetencia[] = Array.from(alocacoesPorId.entries()).map(
    ([mensalidadeId, valorAplicado]) => ({ mensalidadeId, valorAplicado })
  )

  const supabaseAdmin = createSupabaseServiceRoleClient()

  if (alocacoes.length === 0) {
    return { error: 'Selecione ao menos uma competência.' }
  }

  // I1 + I2: restringe a busca ao membro informado e a competências ainda
  // em aberto — sem isso um POST manipulado poderia aplicar pagamento em
  // competências de outro membro, ou "ressuscitar" uma competência
  // CANCELADA/NAO_APLICAVEL que ainda tenha saldo > 0.
  const { data: mensalidades, error: mensalidadesError } = await supabaseAdmin
    .from('mensalidades')
    .select('id, valor_devido, valor_pago, saldo')
    .eq('membro_id', membroId)
    .in('status', ['PENDENTE', 'PARCIAL'])
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

  const aplicadasComSucesso: AlocacaoAplicada[] = []

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
      // C2: desfaz o que já foi aplicado e cancela o pagamento órfão.
      await compensarFalhaParcial(supabaseAdmin, pagamento.id, aplicadasComSucesso, usuario.id)
      return {
        error: `Falha ao vincular competência ao pagamento: ${linkError.message}. O pagamento foi cancelado automaticamente.`,
      }
    }

    const valorPagoAntes = arredondarCentavos(mensalidade.valor_pago)
    const valorDevidoAntes = arredondarCentavos(mensalidade.valor_devido)
    const novoValorPago = arredondarCentavos(valorPagoAntes + alocacao.valorAplicado)
    const novoStatus = calcularNovoStatusMensalidade(valorDevidoAntes, novoValorPago)

    // C3: lock otimista — só aplica o update se valor_pago não mudou desde
    // a leitura. Sem isso, dois pagamentos concorrentes na mesma
    // competência poderiam ambos ler valor_pago=0, ambos passar na
    // validação de saldo e ambos escrever, duplicando o valor aplicado.
    const { data: atualizada, error: updateError } = await supabaseAdmin
      .from('mensalidades')
      .update({
        valor_pago: novoValorPago,
        status: novoStatus,
        data_quitacao: novoStatus === 'QUITADA' ? new Date().toISOString() : null,
      })
      .eq('id', alocacao.mensalidadeId)
      .eq('valor_pago', mensalidade.valor_pago)
      .select('id')
      .single()

    if (updateError || !atualizada) {
      await compensarFalhaParcial(supabaseAdmin, pagamento.id, aplicadasComSucesso, usuario.id)
      return {
        error: updateError
          ? `Falha ao atualizar competência: ${updateError.message}. O pagamento foi cancelado automaticamente.`
          : 'Uma das competências selecionadas foi alterada por outra operação simultânea. Tente novamente.',
      }
    }

    aplicadasComSucesso.push({
      mensalidadeId: alocacao.mensalidadeId,
      valorAplicado: alocacao.valorAplicado,
      valorDevidoAntes,
      valorPagoAntes,
    })
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

  // C1: reivindica o cancelamento atomicamente ANTES de reverter qualquer
  // vínculo. Um UPDATE condicional (`.eq('status', 'ATIVO')`) garante que,
  // se o operador tentar cancelar de novo após uma falha no meio da
  // reversão, a segunda tentativa não encontre linha ATIVO pra reivindicar
  // e pare aqui — em vez de reverter os mesmos vínculos duas vezes.
  const { data: reivindicado, error: reivindicarError } = await supabaseAdmin
    .from('pagamentos')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: motivo.trim(),
      cancelado_por: usuario.id,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', pagamentoId)
    .eq('status', 'ATIVO')
    .select('id')
    .single()

  if (reivindicarError || !reivindicado) {
    return { error: 'Este pagamento já foi cancelado ou não foi encontrado.' }
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

  // I4: snapshot do estado anterior de cada mensalidade, pra auditoria
  // registrar dadosAnteriores (não só o motivo do cancelamento).
  const estadoAnterior: Record<string, { valor_pago: number; status: string }> = {}

  for (const vinculo of vinculos) {
    const { data: mensalidade } = await supabaseAdmin
      .from('mensalidades')
      .select('valor_devido, valor_pago, status')
      .eq('id', vinculo.mensalidade_id)
      .single()

    if (!mensalidade) {
      continue
    }

    estadoAnterior[vinculo.mensalidade_id] = {
      valor_pago: mensalidade.valor_pago,
      status: mensalidade.status,
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

  await recalcularSituacaoMembro(supabaseAdmin, pagamento.membro_id)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'CANCELAMENTO_PAGAMENTO',
      registroTabela: 'pagamentos',
      registroId: pagamentoId,
      dadosAnteriores: { mensalidades: estadoAnterior },
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
