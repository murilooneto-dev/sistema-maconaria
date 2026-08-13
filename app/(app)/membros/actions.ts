'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { validarMembro } from '@/lib/domain/membros'
import { gerarCompetenciasParaMembro } from '@/lib/mensalidades/gerar-competencias-membro'

type ActionState = { error: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarMembro(
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
  const matricula = String(formData.get('matricula') ?? '')
  const telefone = String(formData.get('telefone') ?? '')
  const doQuadro = formData.get('doQuadro') === 'on'
  const remido = formData.get('remido') === 'on'
  const recolhe = formData.get('recolhe') === 'on'
  const emIniciacao = formData.get('emIniciacao') === 'on'

  const validacao = validarMembro({ nome, matricula })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const dadosPersistidos = {
    nome: nome.trim(),
    matricula: matricula.trim() || null,
    telefone: telefone.trim() || null,
    do_quadro: doQuadro,
    remido,
    recolhe,
    em_iniciacao: emIniciacao,
  }

  const { data: criado, error } = await supabaseAdmin
    .from('membros')
    .insert(dadosPersistidos)
    .select('id, data_cadastro')
    .single()

  if (error || !criado) {
    if (error?.code === '23505') {
      return { error: 'Já existe um membro com essa matrícula.' }
    }
    return { error: `Falha ao criar membro: ${error?.message ?? 'erro desconhecido'}` }
  }

  let competenciasGeradas = 0
  if (doQuadro) {
    try {
      competenciasGeradas = await gerarCompetenciasParaMembro(supabaseAdmin, {
        id: criado.id,
        remido,
        data_cadastro: criado.data_cadastro,
      })
    } catch (geracaoError) {
      console.error(
        `Falha ao gerar competências automaticamente para o membro recém-criado ${criado.id}:`,
        geracaoError
      )
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'membros',
      acao: 'CRIACAO',
      registroTabela: 'membros',
      registroId: criado.id,
      dadosNovos: { ...dadosPersistidos, competenciasGeradas },
      descricao: `Criação do membro ${dadosPersistidos.nome}${
        competenciasGeradas > 0 ? ` (${competenciasGeradas} competência(s) gerada(s) automaticamente)` : ''
      }`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (membro criado com sucesso):', auditError)
  }

  revalidatePath('/membros')
  revalidatePath('/mensalidades')
  redirect(`/membros/${criado.id}`)
}

export async function atualizarMembro(
  id: string,
  dados: {
    nome: string
    matricula: string
    telefone: string
    doQuadro: boolean
    remido: boolean
    recolhe: boolean
    emIniciacao: boolean
    observacao: string
  }
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarMembro(dados)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('membros')
    .select('nome, matricula, telefone, do_quadro, remido, recolhe, em_iniciacao, observacao')
    .eq('id', id)
    .single()

  const dadosPersistidos = {
    nome: dados.nome.trim(),
    matricula: dados.matricula.trim() || null,
    telefone: dados.telefone.trim() || null,
    do_quadro: dados.doQuadro,
    remido: dados.remido,
    recolhe: dados.recolhe,
    em_iniciacao: dados.emIniciacao,
    observacao: dados.observacao.trim() || null,
  }

  const { data: atualizado, error } = await supabaseAdmin
    .from('membros')
    .update(dadosPersistidos)
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizado) {
    if (error?.code === '23505') {
      return { error: 'Já existe um membro com essa matrícula.' }
    }
    return { error: `Falha ao atualizar membro: ${error?.message ?? 'membro não encontrado'}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'membros',
      acao: 'EDICAO',
      registroTabela: 'membros',
      registroId: id,
      dadosAnteriores: anterior ?? null,
      dadosNovos: dadosPersistidos,
      descricao: `Edição do membro ${dadosPersistidos.nome}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (membro atualizado com sucesso):', auditError)
  }

  revalidatePath('/membros')
  revalidatePath(`/membros/${id}`)
  return {}
}
