import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovaCampanhaForm } from './NovaCampanhaForm'

export default async function NovaCampanhaPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'TESOUREIRO') {
    return <AcessoNegado />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Nova campanha</h1>
      <NovaCampanhaForm />
    </div>
  )
}
