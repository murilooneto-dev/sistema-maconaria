import 'server-only'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { normalizeUsername, usernameToAuthEmail } from '@/lib/domain/auth'

/**
 * E-mail com que o usuário está registrado no Supabase Auth: o e-mail real
 * cadastrado em `profiles.email`, ou o interno `<username>@loja.internal`
 * para quem não tem e-mail. O login é sempre por username — esta é a única
 * tradução de username para credencial de autenticação.
 *
 * Lança erro se o username for vazio.
 */
export async function resolverEmailDeAutenticacao(username: string): Promise<string> {
  const emailInterno = usernameToAuthEmail(username)

  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('username', normalizeUsername(username))
    .maybeSingle()

  return profile?.email ?? emailInterno
}
