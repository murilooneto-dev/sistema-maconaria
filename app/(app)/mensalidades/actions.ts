'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { gerarCompetenciasParaMembro } from '@/lib/mensalidades/gerar-competencias-membro'
import { recalcularSituacaoMembro } from '@/lib/mensalidades/recalcular-situacao'
import { podeExcluirMensalidade } from '@/lib/domain/mensalidades'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function gerarMensalidades(
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  // Membros IRREGULAR (12+ competências vencidas) não recebem competência
  // nova automaticamente — decisão do usuário (2026-08-13): passam a ficar
  // fora da geração até se regularizarem (o que os tira de IRREGULAR
  // sozinho, via recalcularSituacaoMembro logo abaixo).
  const { data: membros, error: membrosError } = await supabaseAdmin
    .from('membros')
    .select('id, remido, data_cadastro')
    .eq('do_quadro', true)
    .neq('situacao', 'IRREGULAR')

  if (membrosError) {
    return { error: `Falha ao buscar membros: ${membrosError.message}` }
  }

  const { data: configNormal } = await supabaseAdmin
    .from('config_mensalidade')
    .select('id')
    .eq('tipo', 'NORMAL')
    .limit(1)
    .maybeSingle()

  const { data: configRemido } = await supabaseAdmin
    .from('config_mensalidade')
    .select('id')
    .eq('tipo', 'REMIDO')
    .limit(1)
    .maybeSingle()

  let totalGeradas = 0
  let membrosSemConfig = 0

  for (const membro of membros ?? []) {
    const configExiste = membro.remido ? Boolean(configRemido) : Boolean(configNormal)
    if (!configExiste) {
      membrosSemConfig += 1
      continue
    }

    try {
      totalGeradas += await gerarCompetenciasParaMembro(supabaseAdmin, membro)
    } catch (geracaoError) {
      return {
        error: `Falha ao gerar competências para o membro ${membro.id}: ${
          geracaoError instanceof Error ? geracaoError.message : 'erro desconhecido'
        }`,
      }
    }
  }

  // Ponto periódico de recálculo de situação (ATIVO/INATIVO/IRREGULAR): como
  // "vencida" depende só da passagem do calendário, um membro que nunca
  // recebe uma ação de pagamento não teria sua situação reavaliada sozinho.
  // "Gerar mensalidades" já roda mensalmente por rotina do tesoureiro, então
  // aproveita esse gatilho pra reavaliar todo mundo do quadro — inclusive
  // quem já está IRREGULAR, pra poder voltar sozinho se regularizar.
  const { data: todosDoQuadro } = await supabaseAdmin.from('membros').select('id').eq('do_quadro', true)
  for (const membro of todosDoQuadro ?? []) {
    try {
      await recalcularSituacaoMembro(supabaseAdmin, membro.id)
    } catch (recalculoError) {
      console.error(`Falha ao recalcular situação do membro ${membro.id}:`, recalculoError)
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'GERACAO_COMPETENCIAS',
      descricao: `Geração de ${totalGeradas} competência(s) pendente(s)${
        membrosSemConfig > 0 ? ` (${membrosSemConfig} membro(s) sem configuração de mensalidade cadastrada, ignorados)` : ''
      }`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (competências geradas com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')

  if (membrosSemConfig > 0) {
    return {
      success: `${totalGeradas} competência(s) gerada(s). ${membrosSemConfig} membro(s) ignorado(s) por falta de configuração de mensalidade (cadastre em Configurações → Mensalidades/Remidos).`,
    }
  }

  return { success: `${totalGeradas} competência(s) gerada(s) com sucesso.` }
}

function competenciaLabel(m: { ano: number; mes: number }): string {
  return `${String(m.mes).padStart(2, '0')}/${m.ano}`
}

/**
 * "Exclui" competências de um membro marcando-as como CANCELADA (nunca
 * apaga a linha). Só aceita competência PENDENTE sem valor pago. A linha
 * cancelada continua existindo, então a geração de mensalidades não a
 * recria; `reativarMensalidade` desfaz.
 */
export async function excluirMensalidades(
  membroId: string,
  mensalidadeIds: string[],
  motivo: string
): Promise<{ error?: string; excluidas?: number }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (mensalidadeIds.length === 0) {
    return { error: 'Selecione ao menos uma mensalidade.' }
  }
  if (motivo.trim().length === 0) {
    return { error: 'Informe o motivo da exclusão.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: mensalidades, error: buscaError } = await supabaseAdmin
    .from('mensalidades')
    .select('id, ano, mes, status, valor_pago, valor_devido')
    .eq('membro_id', membroId)
    .in('id', mensalidadeIds)

  if (buscaError || !mensalidades) {
    return { error: `Falha ao carregar mensalidades: ${buscaError?.message ?? 'erro desconhecido'}` }
  }
  if (mensalidades.length !== new Set(mensalidadeIds).size) {
    return { error: 'Uma ou mais mensalidades selecionadas não pertencem a este membro.' }
  }

  for (const mensalidade of mensalidades) {
    const validacao = podeExcluirMensalidade(mensalidade)
    if (!validacao.valido) {
      return { error: `${competenciaLabel(mensalidade)}: ${validacao.erro}` }
    }
  }

  // O filtro repete a regra no banco: se um pagamento entrar entre a
  // leitura acima e este update, a competência paga não é cancelada.
  const { data: canceladas, error } = await supabaseAdmin
    .from('mensalidades')
    .update({ status: 'CANCELADA' })
    .eq('membro_id', membroId)
    .in('id', mensalidadeIds)
    .eq('status', 'PENDENTE')
    .eq('valor_pago', 0)
    .select('id, ano, mes')

  if (error) {
    return { error: `Falha ao excluir mensalidades: ${error.message}` }
  }

  const competencias = (canceladas ?? []).map(competenciaLabel)

  if (competencias.length > 0) {
    await recalcularSituacaoMembro(supabaseAdmin, membroId)

    try {
      await registrarAuditoria({
        usuarioId: usuario.id,
        modulo: 'mensalidades',
        acao: 'EXCLUSAO_MENSALIDADE',
        registroTabela: 'membros',
        registroId: membroId,
        dadosAnteriores: { mensalidades },
        dadosNovos: { motivo: motivo.trim(), mensalidadeIds: (canceladas ?? []).map((m) => m.id) },
        descricao: `Exclusão (cancelamento) de ${competencias.length} mensalidade(s): ${competencias.join(', ')}. Motivo: ${motivo.trim()}`,
      })
    } catch (auditError) {
      console.error('Falha ao registrar auditoria (mensalidades excluídas com sucesso):', auditError)
    }
  }

  revalidatePath('/mensalidades')
  revalidatePath('/mensalidades/pagamento')
  revalidatePath(`/membros/${membroId}`)

  if (competencias.length !== mensalidades.length) {
    return {
      error: `${competencias.length} de ${mensalidades.length} mensalidade(s) excluída(s). As demais foram alteradas por outra operação — atualize a página e confira.`,
    }
  }
  return { excluidas: competencias.length }
}

/** Desfaz uma exclusão: a competência CANCELADA volta a PENDENTE e a ser cobrada. */
export async function reativarMensalidade(membroId: string, mensalidadeId: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: reativada, error } = await supabaseAdmin
    .from('mensalidades')
    .update({ status: 'PENDENTE' })
    .eq('id', mensalidadeId)
    .eq('membro_id', membroId)
    .eq('status', 'CANCELADA')
    .eq('valor_pago', 0)
    .select('id, ano, mes')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Já existe outra mensalidade ativa para esta competência.' }
    }
    return { error: `Falha ao reativar mensalidade: ${error.message}` }
  }
  if (!reativada) {
    return { error: 'Mensalidade não encontrada ou não está excluída.' }
  }

  await recalcularSituacaoMembro(supabaseAdmin, membroId)

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'mensalidades',
      acao: 'REATIVACAO_MENSALIDADE',
      registroTabela: 'mensalidades',
      registroId: mensalidadeId,
      descricao: `Reativação da mensalidade ${competenciaLabel(reativada)} (volta a PENDENTE)`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (mensalidade reativada com sucesso):', auditError)
  }

  revalidatePath('/mensalidades')
  revalidatePath('/mensalidades/pagamento')
  revalidatePath(`/membros/${membroId}`)
  return {}
}
