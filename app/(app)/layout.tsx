import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'

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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header
          nome={profile?.nome ?? user.email ?? ''}
          role={profile?.role ?? ''}
          lojaNome={lojaConfig?.nome || 'Loja Maçônica'}
          lojaLogoUrl={lojaConfig?.logo_url ?? null}
        />
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
