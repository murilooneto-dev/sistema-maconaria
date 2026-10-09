'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolverEmailDeAutenticacao } from '@/lib/auth/email-autenticacao'

export async function signIn(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const login = String(formData.get('login') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!login || !password) {
    return { error: 'Informe e-mail e senha.' }
  }

  // O login é por e-mail. Um valor sem "@" é tratado como o username antigo,
  // só para quem ainda não tem e-mail cadastrado não ficar trancado para
  // fora — é assim que o Administrador entra para cadastrar os e-mails.
  let email: string
  try {
    email = login.includes('@') ? login.toLowerCase() : await resolverEmailDeAutenticacao(login)
  } catch {
    return { error: 'E-mail ou senha inválidos.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
