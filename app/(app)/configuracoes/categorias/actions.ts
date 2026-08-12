'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarCategoria(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const nome = String(formData.get('nome') ?? '').trim()
  const tipo = String(formData.get('tipo') ?? '')

  if (nome.length === 0) {
    return { error: 'Informe o nome da categoria.' }
  }
  if (tipo !== 'ENTRADA' && tipo !== 'SAIDA') {
    return { error: 'Selecione o tipo da categoria.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criada, error } = await supabaseAdmin
    .from('categorias_movimentacao')
    .insert({ nome, tipo })
    .select('id')
    .single()

  if (error || !criada) {
    if (error?.code === '23505') {
      return { error: 'Já existe uma categoria com esse nome para esse tipo.' }
    }
    return { error: `Falha ao criar categoria: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_CATEGORIA_MOVIMENTACAO',
      registroTabela: 'categorias_movimentacao',
      registroId: criada.id,
      dadosNovos: { nome, tipo },
      descricao: `Criação da categoria ${nome} (${tipo})`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (categoria criada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/categorias')
  return { success: 'Categoria criada com sucesso.' }
}

export async function atualizarCategoria(
  id: string,
  dados: { nome: string; ativo: boolean }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (dados.nome.trim().length === 0) {
    return { error: 'Informe o nome da categoria.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('categorias_movimentacao')
    .select('nome, ativo, sistema')
    .eq('id', id)
    .single()

  if (anterior?.sistema) {
    return { error: 'Categoria de sistema não pode ser editada.' }
  }

  const { data: atualizada, error } = await supabaseAdmin
    .from('categorias_movimentacao')
    .update({ nome: dados.nome.trim(), ativo: dados.ativo })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizada) {
    return { error: `Falha ao atualizar categoria: ${error?.message ?? 'não encontrada'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CATEGORIA_MOVIMENTACAO',
      registroTabela: 'categorias_movimentacao',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição da categoria ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (categoria atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/categorias')
  return {}
}
