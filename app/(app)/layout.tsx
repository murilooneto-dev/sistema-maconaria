import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, role, ativo')
    .eq('id', user.id)
    .single()

  if (!profile || profile.ativo === false) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  const { data: lojaConfig } = await supabase.from('loja_config').select('nome, logo_url').eq('id', 1).single()

  return (
    <AppShell
      nome={profile?.nome ?? user.email ?? ''}
      role={profile?.role ?? ''}
      lojaNome={lojaConfig?.nome || 'Loja Maçônica'}
      lojaLogoUrl={lojaConfig?.logo_url ?? null}
    >
      {children}
    </AppShell>
  )
}
