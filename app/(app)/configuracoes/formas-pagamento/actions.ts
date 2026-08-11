'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarFormaPagamento } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarFormaPagamento(
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
  const validacao = validarFormaPagamento({ nome })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criada, error } = await supabaseAdmin
    .from('formas_pagamento')
    .insert({ nome: nome.trim() })
    .select('id')
    .single()

  if (error || !criada) {
    if (error?.code === '23505') {
      return { error: 'Já existe uma forma de pagamento com esse nome.' }
    }
    return { error: `Falha ao criar forma de pagamento: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_FORMA_PAGAMENTO',
      registroTabela: 'formas_pagamento',
      registroId: criada.id,
      dadosNovos: { nome: nome.trim() },
      descricao: `Criação da forma de pagamento ${nome.trim()}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (forma de pagamento criada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/formas-pagamento')
  return { success: 'Forma de pagamento criada com sucesso.' }
}

export async function atualizarFormaPagamento(
  id: string,
  dados: { nome: string; ativo: boolean }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarFormaPagamento(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('formas_pagamento')
    .select('nome, ativo')
    .eq('id', id)
    .single()

  const { data: atualizada, error } = await supabaseAdmin
    .from('formas_pagamento')
    .update({ nome: dados.nome.trim(), ativo: dados.ativo })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizada) {
    return { error: `Falha ao atualizar forma de pagamento: ${error?.message ?? 'não encontrada'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_FORMA_PAGAMENTO',
      registroTabela: 'formas_pagamento',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dados,
      descricao: `Edição da forma de pagamento ${id}`,
    })
  } catch (auditError) {
    console.error(
      'Falha ao registrar auditoria (forma de pagamento atualizada com sucesso):',
      auditError
    )
  }

  revalidatePath('/configuracoes/formas-pagamento')
  return {}
}
