'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { calcularFechamento, podeFecharPeriodo, podeReabrir } from '@/lib/domain/financeiro'
import {
  calcularSaldoInicialSemHistorico,
  calcularTotaisPeriodo,
  obterRegistroPeriodo,
  obterUltimoFechado,
} from '@/lib/financeiro/fechamento'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function fecharPeriodo(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const ano = Number(formData.get('ano'))
  const mes = Number(formData.get('mes'))

  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { error: 'Período inválido.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const registroExistente = await obterRegistroPeriodo(supabaseAdmin, ano, mes)

  if (registroExistente && registroExistente.status === 'FECHADO') {
    return { error: 'Este período já está fechado.' }
  }

  let saldoInicial: number
  if (registroExistente && registroExistente.status === 'ABERTO') {
    // Reabertura pendente de re-fechamento: mantém o mesmo saldo_inicial gravado originalmente.
    saldoInicial = Number(registroExistente.saldo_inicial)
  } else {
    const ultimoFechado = await obterUltimoFechado(supabaseAdmin)
    const validacaoSequencia = podeFecharPeriodo(
      ultimoFechado ? { ano: ultimoFechado.ano, mes: ultimoFechado.mes } : null,
      { ano, mes }
    )
    if (!validacaoSequencia.valido) {
      return { error: validacaoSequencia.erro }
    }
    saldoInicial = ultimoFechado
      ? Number(ultimoFechado.saldo_final)
      : await calcularSaldoInicialSemHistorico(supabaseAdmin, ano, mes)
  }

  const { totalEntradas, totalSaidas, totalTransferencias } = await calcularTotaisPeriodo(
    supabaseAdmin,
    ano,
    mes
  )
  const saldoFinal = calcularFechamento({ saldoInicial, totalEntradas, totalSaidas })

  const payload = {
    ano,
    mes,
    saldo_inicial: saldoInicial,
    total_entradas: totalEntradas,
    total_saidas: totalSaidas,
    total_transferencias: totalTransferencias,
    saldo_final: saldoFinal,
    status: 'FECHADO',
    fechado_por: usuario.id,
    fechado_em: new Date().toISOString(),
  }

  const { data: fechamento, error } = registroExistente
    ? await supabaseAdmin
        .from('fechamentos_mensais')
        .update(payload)
        .eq('id', registroExistente.id)
        .eq('status', 'ABERTO')
        .select('id')
        .maybeSingle()
    : await supabaseAdmin.from('fechamentos_mensais').insert(payload).select('id').single()

  if (error || !fechamento) {
    return { error: `Falha ao fechar período: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'financeiro',
      acao: 'FECHAMENTO_MENSAL',
      registroTabela: 'fechamentos_mensais',
      registroId: fechamento.id,
      dadosNovos: payload,
      descricao: `Fechamento do período ${mes}/${ano}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (fechamento realizado com sucesso):', auditError)
  }

  revalidatePath('/financeiro/fechamento')
  return { success: `Período ${mes}/${ano} fechado com sucesso.` }
}

export async function reabrirPeriodo(fechamentoId: string, motivo: string): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (motivo.trim().length === 0) {
    return { error: 'Informe o motivo da reabertura.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: fechamento, error: fechamentoError } = await supabaseAdmin
    .from('fechamentos_mensais')
    .select('id, ano, mes, status')
    .eq('id', fechamentoId)
    .single()

  if (fechamentoError || !fechamento) {
    return { error: 'Fechamento não encontrado.' }
  }

  if (fechamento.status !== 'FECHADO') {
    return { error: 'Este período não está fechado.' }
  }

  const ultimoFechado = await obterUltimoFechado(supabaseAdmin)
  const validacao = podeReabrir(
    { ano: fechamento.ano, mes: fechamento.mes },
    ultimoFechado ? { ano: ultimoFechado.ano, mes: ultimoFechado.mes } : null
  )
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const { data: reaberto, error } = await supabaseAdmin
    .from('fechamentos_mensais')
    .update({
      status: 'ABERTO',
      reaberto_por: admin.id,
      reaberto_em: new Date().toISOString(),
      motivo_reabertura: motivo.trim(),
    })
    .eq('id', fechamentoId)
    .eq('status', 'FECHADO')
    .select('id')
    .maybeSingle()

  if (error || !reaberto) {
    return { error: `Falha ao reabrir período: ${error?.message ?? 'já reaberto por outra operação'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'financeiro',
      acao: 'REABERTURA_FECHAMENTO',
      registroTabela: 'fechamentos_mensais',
      registroId: fechamentoId,
      dadosNovos: { motivo: motivo.trim() },
      descricao: `Reabertura do período ${fechamento.mes}/${fechamento.ano}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (reabertura realizada com sucesso):', auditError)
  }

  revalidatePath('/financeiro/fechamento')
  return {}
}
