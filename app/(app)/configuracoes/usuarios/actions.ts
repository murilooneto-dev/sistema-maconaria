'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { normalizeUsername, usernameToAuthEmail } from '@/lib/domain/auth'
import { validarEdicaoUsuario, validarNovoUsuario } from '@/lib/domain/usuarios'
import type { Role } from '@/lib/domain/authorization'

type CriarUsuarioState = { error: string } | { success: string } | undefined

function mensagemAutorizacao(err: unknown): string {
  return err instanceof AuthorizationError ? err.message : 'Não autorizado.'
}

export async function criarUsuario(
  _prevState: CriarUsuarioState,
  formData: FormData
): Promise<CriarUsuarioState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const input = {
    username: String(formData.get('username') ?? ''),
    nome: String(formData.get('nome') ?? ''),
    role: String(formData.get('role') ?? ''),
    senha: String(formData.get('senha') ?? ''),
  }

  const validacao = validarNovoUsuario(input)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const username = normalizeUsername(input.username)
  const email = usernameToAuthEmail(input.username)
  const role = input.role as Role
  const supabaseAdmin = createSupabaseServiceRoleClient()

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.senha,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: `Falha ao criar usuário: ${createError?.message ?? 'erro desconhecido'}` }
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    username,
    nome: input.nome.trim(),
    role,
    ativo: true,
  })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    return { error: `Falha ao criar perfil: ${profileError.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: 'CRIACAO',
    registroTabela: 'profiles',
    registroId: created.user.id,
    dadosNovos: { username, nome: input.nome.trim(), role, ativo: true },
    descricao: `Criação do usuário ${username}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return { success: 'Usuário criado com sucesso.' }
}

export async function atualizarUsuario(
  id: string,
  nome: string,
  role: string
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarEdicaoUsuario({ nome, role })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('profiles')
    .select('nome, role')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ nome: nome.trim(), role })
    .eq('id', id)

  if (error) {
    return { error: `Falha ao atualizar usuário: ${error.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: 'EDICAO',
    registroTabela: 'profiles',
    registroId: id,
    dadosAnteriores: anterior ?? null,
    dadosNovos: { nome: nome.trim(), role },
    descricao: `Edição do usuário ${id}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return {}
}

export async function alterarStatusUsuario(id: string, ativo: boolean): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (admin.id === id && !ativo) {
    return { error: 'Você não pode desativar seu próprio usuário.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('profiles')
    .select('ativo')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin.from('profiles').update({ ativo }).eq('id', id)

  if (error) {
    return { error: `Falha ao atualizar status: ${error.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: ativo ? 'REATIVACAO' : 'DESATIVACAO',
    registroTabela: 'profiles',
    registroId: id,
    dadosAnteriores: anterior ?? null,
    dadosNovos: { ativo },
    descricao: `${ativo ? 'Reativação' : 'Desativação'} do usuário ${id}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return {}
}

export async function redefinirSenha(id: string, novaSenha: string): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  if (novaSenha.length < 8) {
    return { error: 'A senha deve ter pelo menos 8 caracteres.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: novaSenha })

  if (error) {
    return { error: `Falha ao redefinir senha: ${error.message}` }
  }

  await registrarAuditoria({
    usuarioId: admin.id,
    modulo: 'usuarios',
    acao: 'REDEFINICAO_SENHA',
    registroTabela: 'profiles',
    registroId: id,
    descricao: `Redefinição de senha do usuário ${id}`,
  })

  revalidatePath('/configuracoes/usuarios')
  return {}
}
