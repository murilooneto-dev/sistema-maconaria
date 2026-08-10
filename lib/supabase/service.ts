import 'server-only'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { getPublicEnv } from '@/lib/env'

const REQUIRED_SERVICE_ROLE_MESSAGE =
  'Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não configurada — copie .env.example para .env.local'

const serviceRoleEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, REQUIRED_SERVICE_ROLE_MESSAGE),
})

let cachedServiceRoleKey: string | undefined

/**
 * Lê e valida a service_role key. Vive neste módulo (em vez de lib/env.ts)
 * porque lib/env.ts também é importado por código client-side
 * (lib/supabase/client.ts) e não pode carregar `server-only`. Mantendo o
 * leitor da service_role key aqui, o build falha se este módulo for
 * importado por engano em um componente client-side.
 */
function getServiceRoleKey(): string {
  if (cachedServiceRoleKey) {
    return cachedServiceRoleKey
  }

  const parsed = serviceRoleEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? REQUIRED_SERVICE_ROLE_MESSAGE)
  }

  cachedServiceRoleKey = parsed.data.SUPABASE_SERVICE_ROLE_KEY
  return cachedServiceRoleKey
}

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
