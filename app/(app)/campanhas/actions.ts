'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireTesoureiro, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarCampanha } from '@/lib/domain/campanhas'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarCampanha(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const titulo = String(formData.get('titulo') ?? '').trim()
  const objetivo = String(formData.get('objetivo') ?? '').trim() || null
  const meta = Number(formData.get('meta'))
  const pessoaAjudada = String(formData.get('pessoaAjudada') ?? '').trim() || null
  const contato = String(formData.get('contato') ?? '').trim() || null
  const endereco = String(formData.get('endereco') ?? '').trim() || null
  const descricao = String(formData.get('descricao') ?? '').trim() || null
  const dataInicial = String(formData.get('dataInicial') ?? '')
  const dataFinal = String(formData.get('dataFinal') ?? '').trim() || null

  const validacao = validarCampanha({ titulo, meta, dataInicial, dataFinal })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criada, error } = await supabaseAdmin
    .from('campanhas')
    .insert({
      titulo,
      objetivo,
      meta,
      pessoa_ajudada: pessoaAjudada,
      contato,
      endereco,
      descricao,
      data_inicial: dataInicial,
      data_final: dataFinal,
    })
    .select('id')
    .single()

  if (error || !criada) {
    return { error: `Falha ao criar campanha: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'campanhas',
      acao: 'CRIACAO_CAMPANHA',
      registroTabela: 'campanhas',
      registroId: criada.id,
      dadosNovos: { titulo, meta, dataInicial, dataFinal },
      descricao: `Criação da campanha ${titulo}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (campanha criada com sucesso):', auditError)
  }

  revalidatePath('/campanhas')
  redirect(`/campanhas/${criada.id}`)
}

export async function atualizarCampanha(
  id: string,
  dados: {
    titulo: string
    objetivo: string | null
    meta: number
    pessoaAjudada: string | null
    contato: string | null
    endereco: string | null
    descricao: string | null
    dataInicial: string
    dataFinal: string | null
  }
): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarCampanha(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin.from('campanhas').select('*').eq('id', id).single()

  const { data: atualizada, error } = await supabaseAdmin
    .from('campanhas')
    .update({
      titulo: dados.titulo,
      objetivo: dados.objetivo,
      meta: dados.meta,
      pessoa_ajudada: dados.pessoaAjudada,
      contato: dados.contato,
      endereco: dados.endereco,
      descricao: dados.descricao,
      data_inicial: dados.dataInicial,
      data_final: dados.dataFinal,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizada) {
    return { error: `Falha ao atualizar campanha: ${error?.message ?? 'não encontrada'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'campanhas',
      acao: 'EDICAO_CAMPANHA',
      registroTabela: 'campanhas',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição da campanha ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (campanha atualizada com sucesso):', auditError)
  }

  revalidatePath('/campanhas')
  revalidatePath(`/campanhas/${id}`)
  return {}
}

async function alterarStatusCampanha(
  id: string,
  novoStatus: 'CONCLUIDA' | 'CANCELADA' | 'EM_ANDAMENTO',
  acao: string
): Promise<{ error?: string }> {
  let usuario
  try {
    usuario = await requireTesoureiro()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: campanha } = await supabaseAdmin.from('campanhas').select('id, status').eq('id', id).single()

  if (!campanha) {
    return { error: 'Campanha não encontrada.' }
  }

  if (campanha.status === novoStatus) {
    return { error: 'A campanha já está nesse status.' }
  }

  const { error } = await supabaseAdmin.from('campanhas').update({ status: novoStatus }).eq('id', id)

  if (error) {
    return { error: `Falha ao alterar status: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: usuario.id,
      modulo: 'campanhas',
      acao,
      registroTabela: 'campanhas',
      registroId: id,
      dadosAnteriores: { status: campanha.status },
      dadosNovos: { status: novoStatus },
      descricao: `Campanha ${id}: ${campanha.status} → ${novoStatus}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (status de campanha alterado com sucesso):', auditError)
  }

  revalidatePath('/campanhas')
  revalidatePath(`/campanhas/${id}`)
  return {}
}

export async function concluirCampanha(id: string): Promise<{ error?: string }> {
  return alterarStatusCampanha(id, 'CONCLUIDA', 'CONCLUSAO_CAMPANHA')
}

export async function cancelarCampanha(id: string): Promise<{ error?: string }> {
  return alterarStatusCampanha(id, 'CANCELADA', 'CANCELAMENTO_CAMPANHA')
}

export async function reabrirCampanha(id: string): Promise<{ error?: string }> {
  return alterarStatusCampanha(id, 'EM_ANDAMENTO', 'REABERTURA_CAMPANHA')
}
