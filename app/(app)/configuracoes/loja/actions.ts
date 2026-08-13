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

/** Extrai o caminho relativo ao bucket a partir da URL pública salva em `logo_url` (ex: "logo/123-arquivo.png"). */
function extrairCaminhoDoBucket(url: string, bucket: string): string | null {
  const marcador = `/${bucket}/`
  const indice = url.indexOf(marcador)
  return indice === -1 ? null : url.slice(indice + marcador.length)
}

async function removerArquivoLogoAnterior(
  supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient>,
  logoUrlAnterior: string | null | undefined
): Promise<void> {
  if (!logoUrlAnterior) return
  const caminho = extrairCaminhoDoBucket(logoUrlAnterior, 'loja-assets')
  if (!caminho) return

  const { error } = await supabaseAdmin.storage.from('loja-assets').remove([caminho])
  if (error) {
    console.error(`Falha ao remover logo anterior ("${caminho}") do Storage:`, error.message)
  }
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

  const { data: atualizado, error } = await supabaseAdmin
    .from('loja_config')
    .update(dadosNovos)
    .eq('id', 1)
    .select('id')
    .single()

  if (error || !atualizado) {
    return {
      error: error
        ? `Falha ao atualizar dados da loja: ${error.message}`
        : 'Registro de configuração da Loja não encontrado — contate o suporte técnico.',
    }
  }

  if (logoUrl) {
    await removerArquivoLogoAnterior(supabaseAdmin, anterior?.logo_url)
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

export async function removerLogo(_prevState: ActionState): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: anterior } = await supabaseAdmin
    .from('loja_config')
    .select('nome, logo_url')
    .eq('id', 1)
    .single()

  if (!anterior?.logo_url) {
    return { error: 'A Loja não possui logo cadastrada.' }
  }

  const { error } = await supabaseAdmin.from('loja_config').update({ logo_url: null }).eq('id', 1)

  if (error) {
    return { error: `Falha ao remover a logo: ${error.message}` }
  }

  await removerArquivoLogoAnterior(supabaseAdmin, anterior.logo_url)

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'REMOCAO_LOGO',
      registroTabela: 'loja_config',
      dadosAnteriores: anterior,
      dadosNovos: { logo_url: null },
      descricao: 'Remoção da logo da Loja',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (logo removida com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/loja')
  return { success: 'Logo removida com sucesso.' }
}
