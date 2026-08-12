'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { gerarCompetenciasParaMembro } from '@/lib/mensalidades/gerar-competencias-membro'

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

  const { data: membros, error: membrosError } = await supabaseAdmin
    .from('membros')
    .select('id, remido, data_cadastro')
    .eq('do_quadro', true)

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
