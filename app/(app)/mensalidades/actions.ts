'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { gerarCompetenciasParaMembro } from '@/lib/mensalidades/gerar-competencias-membro'
import { recalcularSituacaoMembro } from '@/lib/mensalidades/recalcular-situacao'

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
