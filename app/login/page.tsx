import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const supabaseAdmin = createSupabaseServiceRoleClient()
  const { data: lojaConfig } = await supabaseAdmin.from('loja_config').select('nome, logo_url').eq('id', 1).single()

  return <LoginForm lojaNome={lojaConfig?.nome || 'Sistema Loja Maçônica'} lojaLogoUrl={lojaConfig?.logo_url ?? null} />
}
