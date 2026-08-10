import { z } from 'zod'

const REQUIRED_URL_MESSAGE =
  'Variável de ambiente NEXT_PUBLIC_SUPABASE_URL não configurada — copie .env.example para .env.local'
const REQUIRED_KEY_MESSAGE =
  'Variável de ambiente NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada — copie .env.example para .env.local'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, REQUIRED_URL_MESSAGE)
    .url(REQUIRED_URL_MESSAGE),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, REQUIRED_KEY_MESSAGE),
})

export type PublicEnv = z.infer<typeof envSchema>

let cachedEnv: PublicEnv | undefined

/**
 * Lê e valida as variáveis de ambiente públicas do Supabase.
 * Lança um erro claro e nomeado caso alguma esteja ausente ou inválida,
 * em vez de deixar `undefined` vazar para o SDK do Supabase silenciosamente.
 */
export function getPublicEnv(): PublicEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  })

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    throw new Error(firstIssue?.message ?? 'Variáveis de ambiente do Supabase inválidas — copie .env.example para .env.local')
  }

  cachedEnv = parsed.data
  return cachedEnv
}

const REQUIRED_SERVICE_ROLE_MESSAGE =
  'Variável de ambiente SUPABASE_SERVICE_ROLE_KEY não configurada — copie .env.example para .env.local'

const serviceRoleEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, REQUIRED_SERVICE_ROLE_MESSAGE),
})

let cachedServiceRoleKey: string | undefined

/**
 * Lê e valida a service_role key. Só deve ser chamada a partir de código
 * server-only (ver lib/supabase/service.ts) — nunca client-side.
 */
export function getServiceRoleKey(): string {
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
