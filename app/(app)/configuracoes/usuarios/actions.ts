'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthorizationError } from '@/lib/auth/require-role'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { normalizeUsername, usernameToAuthEmail } from '@/lib/domain/auth'
import { normalizarEmail, validarEdicaoUsuario, validarNovoUsuario, validarSenha } from '@/lib/domain/usuarios'
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
    email: String(formData.get('email') ?? ''),
  }

  const validacao = validarNovoUsuario(input)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  const username = normalizeUsername(input.username)
  const emailReal = normalizarEmail(input.email)
  // A validação acima já exige e-mail; o interno fica só como rede de segurança.
  const email = emailReal ?? usernameToAuthEmail(input.username)
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
    email: emailReal,
  })

  if (profileError) {
    try {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(created.user.id)

      if (deleteError) {
        console.error('Falha ao reverter criação de usuário órfão:', deleteError)
        return {
          error: `Falha ao criar perfil (${profileError.message}) e também falhou ao reverter o usuário criado — contate o suporte técnico com o ID ${created.user.id}.`,
        }
      }
    } catch (rollbackError) {
      console.error('Falha ao reverter criação de usuário órfão:', rollbackError)
      return {
        error: `Falha ao criar perfil (${profileError.message}) e também falhou ao reverter o usuário criado — contate o suporte técnico com o ID ${created.user.id}.`,
      }
    }
    return { error: `Falha ao criar perfil: ${profileError.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'usuarios',
      acao: 'CRIACAO',
      registroTabela: 'profiles',
      registroId: created.user.id,
      dadosNovos: { username, nome: input.nome.trim(), role, ativo: true, email: emailReal },
      descricao: `Criação do usuário ${username}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (usuário criado com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/usuarios')
  return { success: 'Usuário criado com sucesso.' }
}

export async function atualizarUsuario(
  id: string,
  nome: string,
  role: string,
  email: string
): Promise<{ error?: string }> {
  let admin
  try {
    admin = await requireAdmin()
  } catch (err) {
    return { error: mensagemAutorizacao(err) }
  }

  const validacao = validarEdicaoUsuario({ nome, role, email })
  if (!validacao.valido) {
    return { error: validacao.erro }
  }

  if (admin.id === id && role !== 'ADMINISTRADOR') {
    return { error: 'Você não pode alterar seu próprio perfil de acesso.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: anterior } = await supabaseAdmin
    .from('profiles')
    .select('username, nome, role, email')
    .eq('id', id)
    .single()

  if (!anterior) {
    return { error: 'Usuário não encontrado.' }
  }

  const emailReal = normalizarEmail(email)
  const emailMudou = emailReal !== anterior.email

  // O e-mail de autenticação (auth.users) precisa acompanhar o do perfil: é
  // para ele que o Supabase envia o link de recuperação e é com ele que o
  // login autentica. Troca primeiro no Auth, que é onde a unicidade é
  // garantida; se o perfil falhar depois, desfaz.
  if (emailMudou) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      email: emailReal ?? usernameToAuthEmail(anterior.username),
      email_confirm: true,
    })
    if (authError) {
      return {
        error:
          authError.status === 422
            ? 'Este e-mail já está em uso por outro usuário.'
            : `Falha ao atualizar e-mail: ${authError.message}`,
      }
    }
  }

  const { data: atualizado, error } = await supabaseAdmin
    .from('profiles')
    .update({ nome: nome.trim(), role, ...(emailMudou ? { email: emailReal } : {}) })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizado) {
    if (emailMudou) {
      const { error: reverterError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: anterior.email ?? usernameToAuthEmail(anterior.username),
        email_confirm: true,
      })
      if (reverterError) {
        console.error(
          `Falha ao reverter o e-mail de autenticação do usuário ${id} — perfil e Auth ficaram com e-mails diferentes, requer correção manual:`,
          reverterError.message
        )
        return {
          error: `Falha ao atualizar usuário e também ao desfazer a troca de e-mail — o usuário pode não conseguir entrar. Contate o suporte técnico com o ID ${id}.`,
        }
      }
    }
    return {
      error:
        error?.code === '23505'
          ? 'Este e-mail já está em uso por outro usuário.'
          : `Falha ao atualizar usuário: ${error?.message ?? 'usuário não encontrado.'}`,
    }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'usuarios',
      acao: 'EDICAO',
      registroTabela: 'profiles',
      registroId: id,
      dadosAnteriores: anterior,
      dadosNovos: { nome: nome.trim(), role, email: emailReal },
      descricao: `Edição do usuário ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (usuário atualizado com sucesso):', auditError)
  }

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

  const { data: atualizado, error } = await supabaseAdmin
    .from('profiles')
    .update({ ativo })
    .eq('id', id)
    .select('id')
    .single()

  if (error || !atualizado) {
    return { error: `Falha ao atualizar status: ${error?.message ?? 'usuário não encontrado.'}` }
  }

  try {
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
  } catch (auditError) {
    console.error(
      `Falha ao registrar auditoria (usuário ${ativo ? 'reativado' : 'desativado'} com sucesso):`,
      auditError
    )
  }

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

  const validacaoSenha = validarSenha(novaSenha)
  if (!validacaoSenha.valido) {
    return { error: validacaoSenha.erro }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: novaSenha })

  if (error) {
    return { error: `Falha ao redefinir senha: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: admin.id,
      modulo: 'usuarios',
      acao: 'REDEFINICAO_SENHA',
      registroTabela: 'profiles',
      registroId: id,
      descricao: `Redefinição de senha do usuário ${id}`,
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (senha redefinida com sucesso):', auditError)
  }

  revalidatePath('/configuracoes/usuarios')
  return {}
}
