'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { registrarAuditoria } from '@/lib/audit'
import { validarSenha } from '@/lib/domain/usuarios'

export async function definirNovaSenha(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const senha = String(formData.get('senha') ?? '')
  const confirmacao = String(formData.get('confirmacao') ?? '')

  const validacao = validarSenha(senha)
  if (!validacao.valido) {
    return { error: validacao.erro }
  }
  if (senha !== confirmacao) {
    return { error: 'As senhas não conferem.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'O link de recuperação expirou. Solicite um novo na tela de login.' }
  }

  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) {
    return { error: `Falha ao definir a nova senha: ${error.message}` }
  }

  try {
    await registrarAuditoria({
      usuarioId: user.id,
      modulo: 'usuarios',
      acao: 'REDEFINICAO_SENHA',
      registroTabela: 'profiles',
      registroId: user.id,
      descricao: 'Senha redefinida pelo próprio usuário via link de recuperação',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (senha redefinida com sucesso):', auditError)
  }

  redirect('/dashboard')
}
