'use server'

import { revalidatePath } from 'next/cache'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { competenciasFaltantes, proximaCompetenciaAposCadastro, type Competencia } from '@/lib/domain/competencias'

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

  const hoje = new Date()
  const competenciaAtual: Competencia = { ano: hoje.getUTCFullYear(), mes: hoje.getUTCMonth() + 1 }

  const { data: membros, error: membrosError } = await supabaseAdmin
    .from('membros')
    .select('id, remido, data_cadastro')
    .eq('do_quadro', true)

  if (membrosError) {
    return { error: `Falha ao buscar membros: ${membrosError.message}` }
  }

  const { data: configNormal } = await supabaseAdmin
    .from('config_mensalidade')
    .select('valor_mensalidade, valor_grande_loja, valor_loja')
    .eq('tipo', 'NORMAL')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  const { data: configRemido } = await supabaseAdmin
    .from('config_mensalidade')
    .select('valor_mensalidade, valor_grande_loja, valor_loja')
    .eq('tipo', 'REMIDO')
    .order('vigente_desde', { ascending: false })
    .limit(1)
    .single()

  let totalGeradas = 0
  let membrosSemConfig = 0

  for (const membro of membros ?? []) {
    const config = membro.remido ? configRemido : configNormal
    if (!config) {
      membrosSemConfig += 1
      continue
    }

    const primeira = proximaCompetenciaAposCadastro(membro.data_cadastro)

    const { data: existentes } = await supabaseAdmin
      .from('mensalidades')
      .select('ano, mes')
      .eq('membro_id', membro.id)

    const faltantes = competenciasFaltantes(primeira, competenciaAtual, existentes ?? [])

    if (faltantes.length === 0) {
      continue
    }

    const novasLinhas = faltantes.map((competencia) => ({
      membro_id: membro.id,
      ano: competencia.ano,
      mes: competencia.mes,
      valor_devido: config.valor_mensalidade,
      valor_grande_loja: config.valor_grande_loja,
      valor_loja: config.valor_loja,
    }))

    const { error: insertError } = await supabaseAdmin.from('mensalidades').insert(novasLinhas)

    if (insertError) {
      return {
        error: `Falha ao gerar competências para o membro ${membro.id}: ${insertError.message}`,
      }
    }

    totalGeradas += novasLinhas.length
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
