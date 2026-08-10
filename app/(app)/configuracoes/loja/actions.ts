'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarLoja } from '@/lib/domain/configuracoes'

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

export async function atualizarLoja(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const nome = String(formData.get('nome') ?? '')
  const validacao = validarLoja({ nome })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const logo = formData.get('logo')
  let logoUrl: string | undefined

  if (logo instanceof File && logo.size > 0) {
    const path = `logo/${Date.now()}-${sanitizarNomeArquivo(logo.name)}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('loja-assets')
      .upload(path, logo, { upsert: false })

    if (uploadError) {
      return { error: `Falha ao enviar logo: ${uploadError.message}` }
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from('loja-assets').getPublicUrl(path)
    logoUrl = publicUrlData.publicUrl
  }

  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('nome, logo_url')
    .eq('id', 1)
    .single()

  const dadosNovos: { nome: string; logo_url?: string } = { nome: nome.trim() }
  if (logoUrl) {
    dadosNovos.logo_url = logoUrl
  }

  const { error } = await supabaseAdmin.from('loja_config').update(dadosNovos).eq('id', 1)

  if (error) {
    return { error: `Falha ao atualizar dados da loja: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_LOJA',
      registroTabela: 'loja_config',
      dadosAnteriores: anterior ?? null,
      dadosNovos,
      descricao: 'Atualização dos dados da Loja',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (loja atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/loja')
  return { success: 'Dados da Loja atualizados com sucesso.' }
}
