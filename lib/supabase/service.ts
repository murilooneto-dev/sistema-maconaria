import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getPublicEnv, getServiceRoleKey } from '@/lib/env'

/**
 * Client Supabase com a service_role key — ignora RLS inteiramente.
 * Nunca chamar a partir de código que não tenha antes verificado a
 * autorização do usuário chamador (ver lib/auth/require-role.ts).
 * O pacote `server-only` faz o build falhar se este módulo for importado
 * por engano em um componente client-side.
 */
export function createSupabaseServiceRoleClient() {
  const env = getPublicEnv()
  const serviceRoleKey = getServiceRoleKey()

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
