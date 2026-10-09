'use server'

import { headers } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { registrarAuditoria } from '@/lib/audit'
import { normalizarEmail } from '@/lib/domain/usuarios'

type RecuperarSenhaState = { error: string } | { success: string } | undefined

// A mesma resposta para e-mail não cadastrado, usuário inativo ou falha no
// envio — a tela é pública e não pode servir para descobrir quais e-mails
// têm conta no sistema.
const RESPOSTA_GENERICA =
  'Se este e-mail estiver cadastrado, enviamos um link para definir uma nova senha. Confira também a caixa de spam. Se não receber, peça a um Administrador para redefinir sua senha.'

export async function solicitarRecuperacaoSenha(
  _prevState: RecuperarSenhaState,
  formData: FormData
): Promise<RecuperarSenhaState> {
  const email = normalizarEmail(String(formData.get('email') ?? ''))

  if (email === null) {
    return { error: 'Informe o e-mail.' }
  }

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, ativo')
    .eq('email', email)
    .maybeSingle()

  if (!profile || !profile.ativo || !profile.email) {
    return { success: RESPOSTA_GENERICA }
  }

  const origem = (await headers()).get('origin')
  if (!origem) {
    console.error('Recuperação de senha: requisição sem cabeçalho Origin — link não enviado.')
    return { success: RESPOSTA_GENERICA }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${origem}/auth/confirm`,
  })

  if (error) {
    console.error(`Recuperação de senha: falha ao enviar link para o usuário ${profile.id}: ${error.message}`)
    return { success: RESPOSTA_GENERICA }
  }

  try {
    await registrarAuditoria({
      usuarioId: profile.id,
      modulo: 'usuarios',
      acao: 'SOLICITACAO_RECUPERACAO_SENHA',
      registroTabela: 'profiles',
      registroId: profile.id,
      descricao: 'Link de recuperação de senha enviado para o e-mail cadastrado do usuário',
    })
  } catch (auditError) {
    console.error('Falha ao registrar auditoria (link de recuperação enviado):', auditError)
  }

  return { success: RESPOSTA_GENERICA }
}
