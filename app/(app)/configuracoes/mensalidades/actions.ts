'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarConfigMensalidade } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function salvarConfigMensalidade(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const tipo = String(formData.get('tipo') ?? '')
  const valorMensalidade = Number(formData.get('valorMensalidade'))
  const valorGrandeLoja = Number(formData.get('valorGrandeLoja'))

  const validacao = validarConfigMensalidade({ tipo, valorMensalidade, valorGrandeLoja })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: criada, error } = await supabaseAdmin
    .from('config_mensalidade')
    .insert({
      tipo,
      valor_mensalidade: valorMensalidade,
      valor_grande_loja: valorGrandeLoja,
      criado_por: admin.id,
    })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao salvar configuração: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'NOVA_CONFIG_MENSALIDADE',
      registroTabela: 'config_mensalidade',
      registroId: criada.id,
      dadosNovos: { tipo, valorMensalidade, valorGrandeLoja },
      descricao: `Nova configuração de mensalidade (${tipo})`,
    })
  } catch (auditError) {
    console.error(
      'Falha ao registrar auditoria (config de mensalidade salva com sucesso):',
      auditError
    )
  }

  revalidatePath('/configuracoes/mensalidades')
  return {
    success: 'Nova configuração salva com sucesso. Vale a partir de agora para novas competências.',
  }
}
