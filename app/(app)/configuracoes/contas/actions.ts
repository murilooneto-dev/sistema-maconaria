'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarConta } from '@/lib/domain/configuracoes'

type ActionState = { error: string } | { success: string } | undefined
type DadosConta = {
  nome: string
  descricao: string
  saldoInicial: number
  dataSaldoInicial: string
  ativo: boolean
}

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarConta(
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
  const descricao = String(formData.get('descricao') ?? '')
  const saldoInicial = Number(formData.get('saldoInicial'))
  const dataSaldoInicial = String(formData.get('dataSaldoInicial') ?? '')

  const validacao = validarConta({ nome, saldoInicial, dataSaldoInicial })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: criada, error } = await supabaseAdmin
    .from('contas')
    .insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      saldo_inicial: saldoInicial,
      data_saldo_inicial: dataSaldoInicial,
    })
    .select('id')
    .single()

  if (error || !criada) {
    if (error?.code === '23505') {
      return { error: 'Já existe uma conta com esse nome.' }
    }
    return { error: `Falha ao criar conta: ${error?.message ?? 'erro desconhecido'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'CRIACAO_CONTA',
      registroTabela: 'contas',
      registroId: criada.id,
      dadosNovos: {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        saldo_inicial: saldoInicial,
        data_saldo_inicial: dataSaldoInicial,
      },
      descricao: `Criação da conta ${nome.trim()}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (conta criada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/contas')
  return { success: 'Conta criada com sucesso.' }
}

export async function atualizarConta(id: string, dados: DadosConta): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarConta(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('contas')
    .select('nome, descricao, saldo_inicial, data_saldo_inicial, ativo')
    .eq('id', id)
    .single()

  const { data: atualizada, error } = await supabaseAdmin
    .from('contas')
    .update({
      nome: dados.nome.trim(),
      descricao: dados.descricao.trim() || null,
      saldo_inicial: dados.saldoInicial,
      data_saldo_inicial: dados.dataSaldoInicial,
      ativo: dados.ativo,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizada) {
    return { error: `Falha ao atualizar conta: ${error?.message ?? 'conta não encontrada'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'configuracoes',
      acao: 'EDICAO_CONTA',
      registroTabela: 'contas',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: {
        nome: dados.nome.trim(),
        descricao: dados.descricao.trim() || null,
        saldo_inicial: dados.saldoInicial,
        data_saldo_inicial: dados.dataSaldoInicial,
        ativo: dados.ativo,
      },
      descricao: `Edição da conta ${dados.nome.trim()}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (conta atualizada com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/contas')
  return {}
}
