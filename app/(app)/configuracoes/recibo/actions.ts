'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function atualizarAssinatura(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const assinatura = formData.get('assinatura')
  if (!(assinatura instanceof File) || assinatura.size === 0) {
    return { error: 'Selecione uma imagem de assinatura.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const path = `assinaturas/${Date.now()}-${assinatura.name}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('loja-assets')
    .upload(path, assinatura, { upsert: false })

  if (uploadError) {
    return { error: `Falha ao enviar assinatura: ${uploadError.message}` }
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from('loja-assets').getPublicUrl(path)

  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('assinatura_url')
    .eq('id', 1)
    .single()

  const { error } = await supabaseAdmin
    .from('loja_config')
    .update({ assinatura_url: publicUrlData.publicUrl })
    .eq('id', 1)

  if (error) {
    return { error: `Falha ao salvar assinatura: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_ASSINATURA_RECIBO',
      registroTabela: 'loja_config',
      dadosAnteriores: anterior ?? null,
      dadosNovos: { assinatura_url: publicUrlData.publicUrl },
      descricao: 'Atualização da assinatura usada nos recibos',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (assinatura atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/recibo')
  return { success: 'Assinatura atualizada com sucesso.' }
}
