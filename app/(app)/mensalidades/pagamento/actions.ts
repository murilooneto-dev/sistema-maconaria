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
import { criarMovimentacaoPagamento, cancelarMovimentacaoPagamento } from '@/lib/financeiro/movimentacao-pagamento'
import { periodoEstaFechado } from '@/lib/financeiro/periodo'
import { sincronizarItemGrandeLoja } from '@/lib/grande-loja/sincronizar-item'

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
 *
 * N1 (Fix round 2): a reversão usa lock otimista — só reverte uma
 * mensalidade se `valor_pago` ainda for exatamente o valor que ESTA
 * aplicação escreveu (`valorPagoAntes + valorAplicado`). Sem isso, se um
 * pagamento concorrente alterasse a mesma competência entre a aplicação e
 * a compensação, a reversão incondicional apagaria o valor desse
 * pagamento concorrente sem deixar rastro. Quando o lock falha, a
 * mensalidade entra em `falhasDeReversao` (retornado ao chamador) em vez
 * de ser assumida como revertida com sucesso.
 *
 * N2 (Fix round 2): registra auditoria do cancelamento automático,
 * incluindo quais mensalidades (se houver) não puderam ser revertidas —
 * nunca falha silenciosamente.
 */
async function compensarFalhaParcial(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  pagamentoId: string,
  aplicadas: AlocacaoAplicada[],
  usuarioId: string
): Promise<string[]> {
  const falhasDeReversao: string[] = []

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

    const valorEsperadoAntesDoRevert = arredondarCentavos(item.valorPagoAntes + item.valorAplicado)

    const { data: revertida, error: revertError } = await supabaseAdmin
      .from('mensalidades')
      .update(payload)
      .eq('id', item.mensalidadeId)
      .eq('valor_pago', valorEsperadoAntesDoRevert) // lock otimista: só reverte se o valor ainda é o que esta função aplicou
      .select('id')
      .maybeSingle()

    if (revertError || !revertida) {
      falhasDeReversao.push(item.mensalidadeId)
      console.error(
        `Falha ao reverter mensalidade ${item.mensalidadeId} durante compensação automática — valor pode ter sido alterado por outra operação concorrente. Requer correção manual.`
      )
    }
  }

  const { data: pagamentoCancelado, error: cancelarError } = await supabaseAdmin
    .from('pagamentos')
    .update({
      status: 'CANCELADO',
      motivo_cancelamento: 'Cancelado automaticamente: falha ao registrar todas as competências selecionadas.',
      cancelado_por: usuarioId,
      cancelado_em: new Date().toISOString(),
    })
    .eq('id', pagamentoId)
    .eq('status', 'ATIVO')
    .select('id')
    .maybeSingle()

  const cancelamentoConfirmado = !cancelarError && Boolean(pagamentoCancelado)
  if (!cancelamentoConfirmado) {
    console.error(
      `Falha ao cancelar automaticamente o pagamento ${pagamentoId} durante a compensação — requer correção manual.`
    )
  }

  try {
    await registrarAuditoria({
      usuarioId,
      modulo: 'mensalidades',
      acao: cancelamentoConfirmado ? 'CANCELAMENTO_AUTOMATICO_PARCIAL' : 'FALHA_CANCELAMENTO_AUTOMATICO',
      registroTabela: 'pagamentos',
      registroId: pagamentoId,
      dadosNovos: {
        pagamentoCancelado: cancelamentoConfirmado,
        mensalidadesRevertidas: aplicadas.length - falhasDeReversao.length,
        mensalidadesComFalhaDeReversao: falhasDeReversao,
      },
      descricao: !cancelamentoConfirmado
        ? `Falha ao cancelar automaticamente o pagamento ${pagamentoId} após erro no registro — requer conferência manual imediata (pagamento pode continuar ATIVO com dados inconsistentes).`
        : falhasDeReversao.length > 0
          ? `Cancelamento automático do pagamento ${pagamentoId} após falha no registro — ${falhasDeReversao.length} competência(s) não puderam ser revertidas automaticamente e precisam de conferência manual.`
          : `Cancelamento automático do pagamento ${pagamentoId} após falha no registro de todas as competências selecionadas.`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria do cancelamento automático:', auditError)
  }

  return falhasDeReversao
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
      const falhasDeReversao = await compensarFalhaParcial(
        supabaseAdmin,
        pagamento.id,
        aplicadasComSucesso,
        usuario.id
      )
      if (falhasDeReversao.length > 0) {
        return {
          error: `Falha ao registrar pagamento. O pagamento foi cancelado, mas ${falhasDeReversao.length} competência(s) podem precisar de conferência manual (contate o suporte com o ID do pagamento: ${pagamento.id}).`,
        }
      }
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
    // N3 (Fix round 2): usa `.maybeSingle()` em vez de `.single()` — com
    // `.single()`, zero linhas afetadas pelo lock vira um erro genérico do
    // PostgREST (nunca `data: null`), então a branch de "operação
    // simultânea" abaixo nunca era alcançada de fato.
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
      .maybeSingle()

    if (updateError) {
      const falhasDeReversao = await compensarFalhaParcial(
        supabaseAdmin,
        pagamento.id,
        aplicadasComSucesso,
        usuario.id
      )
      if (falhasDeReversao.length > 0) {
        return {
          error: `Falha ao registrar pagamento. O pagamento foi cancelado, mas ${falhasDeReversao.length} competência(s) podem precisar de conferência manual (contate o suporte com o ID do pagamento: ${pagamento.id}).`,
        }
      }
      return {
        error: `Falha ao atualizar competência: ${updateError.message}. O pagamento foi cancelado automaticamente.`,
      }
    }

    if (!atualizada) {
      // N1/N3: data null (sem erro) com .maybeSingle() = o lock otimista
      // não encontrou a linha com o valor_pago esperado — outra operação
      // alterou a competência entre a leitura e este update.
      const falhasDeReversao = await compensarFalhaParcial(
        supabaseAdmin,
        pagamento.id,
        aplicadasComSucesso,
        usuario.id
      )
      if (falhasDeReversao.length > 0) {
        return {
          error: `Falha ao registrar pagamento. O pagamento foi cancelado, mas ${falhasDeReversao.length} competência(s) podem precisar de conferência manual (contate o suporte com o ID do pagamento: ${pagamento.id}).`,
        }
      }
      return {
        error:
          'Uma das competências selecionadas foi alterada por outra operação simultânea. Tente novamente. O pagamento foi cancelado automaticamente.',
      }
    }

    aplicadasComSucesso.push({
      mensalidadeId: alocacao.mensalidadeId,
      valorAplicado: alocacao.valorAplicado,
      valorDevidoAntes,
      valorPagoAntes,
    })

    try {
      await sincronizarItemGrandeLoja(supabaseAdmin, alocacao.mensalidadeId)
    } catch (glError) {
      console.error(
        `Falha ao sincronizar item de Grande Loja da mensalidade ${alocacao.mensalidadeId}:`,
        glError
      )
    }
  }

  // Vínculo com o financeiro (Fase 7): só cria a movimentação depois que
  // todas as alocações foram aplicadas com sucesso, pra nunca precisar
  // compensar a própria movimentação — se falhar aqui, compensa o
  // pagamento inteiro do mesmo jeito que uma falha no meio do loop.
  const movimentacaoResult = await criarMovimentacaoPagamento(supabaseAdmin, {
    pagamentoId: pagamento.id,
    membroId,
    contaId,
    formaPagamentoId,
    valor: valorTotal,
    data: dataPagamento,
    usuarioId: usuario.id,
  })

  if (movimentacaoResult.error) {
    const falhasDeReversao = await compensarFalhaParcial(
      supabaseAdmin,
      pagamento.id,
      aplicadasComSucesso,
      usuario.id
    )
    if (falhasDeReversao.length > 0) {
      return {
        error: `Falha ao registrar movimentação financeira. O pagamento foi cancelado, mas ${falhasDeReversao.length} competência(s) podem precisar de conferência manual (contate o suporte com o ID do pagamento: ${pagamento.id}).`,
      }
    }
    return {
      error: `Falha ao registrar movimentação financeira: ${movimentacaoResult.error}. O pagamento foi cancelado automaticamente.`,
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
    .select('id, membro_id, status, data_pagamento')
    .eq('id', pagamentoId)
    .single()

  if (pagamentoError || !pagamento) {
    return { error: 'Pagamento não encontrado.' }
  }

  if (pagamento.status === 'CANCELADO') {
    return { error: 'Este pagamento já está cancelado.' }
  }

  if (await periodoEstaFechado(supabaseAdmin, pagamento.data_pagamento)) {
    return { error: 'Não é possível cancelar: o período deste pagamento já está fechado.' }
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
      // N2.3: o cancelamento já foi reivindicado (pagamento CANCELADO) —
      // não há como tentar de novo (a guarda no topo bloqueia), então essa
      // falha de reversão não pode ficar silenciosa. Registra auditoria e
      // devolve uma mensagem clara pedindo conferência manual, em vez de
      // um erro genérico.
      try {
        await registrarAuditoria({
          usuarioId: usuario.id,
          modulo: 'mensalidades',
          acao: 'CANCELAMENTO_COM_REVERSAO_INCOMPLETA',
          registroTabela: 'pagamentos',
          registroId: pagamentoId,
          dadosAnteriores: { mensalidades: estadoAnterior },
          dadosNovos: {
            motivo: motivo.trim(),
            mensalidadeComFalha: vinculo.mensalidade_id,
            erro: updateError.message,
          },
          descricao: `Cancelamento do pagamento ${pagamentoId} foi efetivado, mas a reversão da competência ${vinculo.mensalidade_id} falhou (${updateError.message}). Requer conferência manual.`,
        })
      } catch (auditError) {
        console.error('Falha ao registrar auditoria de reversão incompleta:', auditError)
      }

      return {
        error: `O cancelamento do pagamento foi efetivado, mas a reversão de valores está incompleta (falha ao reverter a competência ${vinculo.mensalidade_id}). Contate o suporte para conferência manual do pagamento ${pagamentoId}.`,
      }
    }

    try {
      await sincronizarItemGrandeLoja(supabaseAdmin, vinculo.mensalidade_id)
    } catch (glError) {
      console.error(`Falha ao sincronizar item de Grande Loja da mensalidade ${vinculo.mensalidade_id}:`, glError)
    }
  }

  const movimentacaoResult = await cancelarMovimentacaoPagamento(
    supabaseAdmin,
    pagamentoId,
    motivo.trim(),
    usuario.id
  )
  if (movimentacaoResult.error) {
    console.error(
      `Falha ao cancelar a movimentação vinculada ao pagamento ${pagamentoId}: ${movimentacaoResult.error}. Requer conferência manual.`
    )
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
