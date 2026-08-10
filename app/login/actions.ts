'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { usernameToAuthEmail } from '@/lib/domain/auth'

export async function signIn(
  _prevState: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string } | undefined> {
  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!username || !password) {
    return { error: 'Informe usuário e senha.' }
  }

  let email: string
  try {
    email = usernameToAuthEmail(username)
  } catch {
    return { error: 'Usuário inválido.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Usuário ou senha inválidos.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
