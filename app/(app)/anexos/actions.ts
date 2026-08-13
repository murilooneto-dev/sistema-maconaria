'use server'

import { revalidatePath } from 'next/cache'
import { requireAutenticado, requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { gerarUrlAssinada } from '@/lib/anexos/signed-url'
import { uploadAnexosDoFormulario } from '@/lib/anexos/upload'

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function obterUrlAnexo(anexoId: string): Promise<{ url?: string; error?: string }> {
  try {
    await requireAutenticado()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anexo, error } = await supabaseAdmin
    .from('anexos')
    .select('path, status')
    .eq('id', anexoId)
    .single()

  if (error || !anexo || anexo.status !== 'ATIVO') {
    return { error: 'Anexo não encontrado.' }
  }

  const resultado = await gerarUrlAssinada(supabaseAdmin, anexo.path)
  if ('error' in resultado) {
    return { error: resultado.error }
  }

  return { url: resultado.url }
}

export async function excluirAnexo(anexoId: string): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anexo, error: buscaError } = await supabaseAdmin
    .from('anexos')
    .select('id, entidade_tipo, entidade_id, nome_arquivo, status')
    .eq('id', anexoId)
    .single()

  if (buscaError || !anexo) {
    return { error: 'Anexo não encontrado.' }
  }

  if (anexo.status === 'EXCLUIDO') {
    return { error: 'Este anexo já foi excluído.' }
  }

  const { data: excluido, error } = await supabaseAdmin
    .from('anexos')
    .update({ status: 'EXCLUIDO', excluido_por: usuario.id, excluido_em: new Date().toISOString() })
    .eq('id', anexoId)
    .eq('status', 'ATIVO')
    .select('id')
    .maybeSingle()

  if (error || !excluido) {
    return { error: `Falha ao excluir anexo: ${error?.message ?? 'já excluído por outra operação'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'anexos',
      acao: 'EXCLUSAO_ANEXO',
      registroTabela: 'anexos',
      registroId: anexoId,
      dadosAnteriores: { nomeArquivo: anexo.nome_arquivo },
      descricao: `Exclusão do anexo "${anexo.nome_arquivo}" (${anexo.entidade_tipo})`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (anexo excluído com sucesso):', auditError)
  }

  if (anexo.entidade_tipo === 'MEMBRO') {
    revalidatePath(`/membros/${anexo.entidade_id}`)
  } else if (anexo.entidade_tipo === 'PAGAMENTO') {
    revalidatePath('/mensalidades/pagamento')
  } else {
    revalidatePath('/financeiro')
  }

  return {}
}

export async function enviarAnexosMembro(
  membroId: string,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: membro } = await supabaseAdmin.from('membros').select('id').eq('id', membroId).single()
  if (!membro) {
    return { error: 'Membro não encontrado.' }
  }

  const { enviados, erros } = await uploadAnexosDoFormulario(supabaseAdmin, formData, 'arquivos', {
    entidadeTipo: 'MEMBRO',
    entidadeId: membroId,
    enviadoPor: usuario.id,
  })

  if (enviados === 0) {
    return { error: erros.length > 0 ? erros.join(' ') : 'Selecione ao menos um arquivo.' }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'membros',
      acao: 'ENVIO_ANEXO',
      registroTabela: 'anexos',
      registroId: membroId,
      dadosNovos: { membroId, enviados },
      descricao: `${enviados} anexo(s) enviado(s) para o membro ${membroId}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (anexo enviado com sucesso):', auditError)
  }

  revalidatePath(`/membros/${membroId}`)

  if (erros.length > 0) {
    return { success: `${enviados} arquivo(s) enviado(s). Falhas: ${erros.join(' ')}` }
  }
  return { success: `${enviados} arquivo(s) enviado(s) com sucesso.` }
}
