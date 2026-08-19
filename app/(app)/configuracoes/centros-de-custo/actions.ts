'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

const HEX_COR_REGEX = /^#[0-9a-fA-F]{6}$/

export async function criarCentroDeCusto(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const nome = String(formData.get('nome') ?? '').trim()
  const cor = String(formData.get('cor') ?? '').trim()

  if (nome.length === 0) {
    return { error: 'Informe o nome do centro de custo.' }
  }
  if (!HEX_COR_REGEX.test(cor)) {
    return { error: 'Selecione uma cor válida.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criado, error } = await supabaseAdmin
    .from('centros_de_custo')
    .insert({ nome, cor })
    .select('id')
    .single()

  if (error || !criado) {
    if (error?.code === '23505') {
      return { error: 'Já existe um centro de custo com esse nome.' }
    }
    return { error: `Falha ao criar centro de custo: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_CENTRO_CUSTO',
      registroTabela: 'centros_de_custo',
      registroId: criado.id,
      dadosNovos: { nome, cor },
      descricao: `Criação do centro de custo ${nome}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (centro de custo criado com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/centros-de-custo')
  revalidatePath('/financeiro')
  return { success: 'Centro de custo criado com sucesso.' }
}

export async function atualizarCentroDeCusto(
  id: string,
  dados: { nome: string; cor: string; ativo: boolean }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (dados.nome.trim().length === 0) {
    return { error: 'Informe o nome do centro de custo.' }
  }
  if (!HEX_COR_REGEX.test(dados.cor)) {
    return { error: 'Selecione uma cor válida.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('centros_de_custo')
    .select('nome, cor, ativo')
    .eq('id', id)
    .single()

  const { data: atualizado, error } = await supabaseAdmin
    .from('centros_de_custo')
    .update({ nome: dados.nome.trim(), cor: dados.cor, ativo: dados.ativo })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizado) {
    return { error: `Falha ao atualizar centro de custo: ${error?.message ?? 'não encontrado'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CENTRO_CUSTO',
      registroTabela: 'centros_de_custo',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição do centro de custo ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (centro de custo atualizado com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/centros-de-custo')
  revalidatePath('/financeiro')
  return {}
}

export async function atualizarCategoriasDoCentro(id: string, categoriaIds: string[]): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: anteriores } = await supabaseAdmin
    .from('centros_de_custo_categorias')
    .select('categoria_id')
    .eq('centro_de_custo_id', id)

  const { error: deleteError } = await supabaseAdmin
    .from('centros_de_custo_categorias')
    .delete()
    .eq('centro_de_custo_id', id)

  if (deleteError) {
    return { error: `Falha ao atualizar categorias do centro: ${deleteError.message}` }
  }

  if (categoriaIds.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('centros_de_custo_categorias')
      .insert(categoriaIds.map((categoriaId) => ({ centro_de_custo_id: id, categoria_id: categoriaId })))

    if (insertError) {
      return { error: `Falha ao atualizar categorias do centro: ${insertError.message}` }
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CATEGORIAS_CENTRO_CUSTO',
      registroTabela: 'centros_de_custo_categorias',
      registroId: id,
      dadosAnteriores: { categoriaIds: (anteriores ?? []).map((a) => a.categoria_id) },
      dadosNovos: { categoriaIds },
      descricao: `Atualização das categorias do centro de custo ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (categorias do centro atualizadas com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/centros-de-custo')
  revalidatePath('/financeiro')
  return {}
}
