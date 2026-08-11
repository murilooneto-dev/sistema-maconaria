'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9.-]/g, '_') // troca qualquer coisa que não seja letra/número/ponto/hífen por _
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
  const path = `assinaturas/${Date.now()}-${sanitizarNomeArquivo(assinatura.name)}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('loja-assinaturas')
    .upload(path, assinatura, { upsert: false })

  if (uploadError) {
    return { error: `Falha ao enviar assinatura: ${uploadError.message}` }
  }

  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('assinatura_url')
    .eq('id', 1)
    .single()

  const { data: atualizado, error } = await supabaseAdmin
    .from('loja_config')
    .update({ assinatura_url: path })
    .eq('id', 1)
    .select('id')
    .single()

  if (error || !atualizado) {
    return {
      error: error
        ? `Falha ao salvar assinatura: ${error.message}`
        : 'Registro de configuração da Loja não encontrado — contate o suporte técnico.',
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_ASSINATURA_RECIBO',
      registroTabela: 'loja_config',
      dadosAnteriores: anterior ?? null,
      dadosNovos: { assinatura_url: path },
      descricao: 'Atualização da assinatura usada nos recibos',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (assinatura atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/recibo')
  return { success: 'Assinatura atualizada com sucesso.' }
}
