import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovoMembroForm } from './NovoMembroForm'

export default async function NovoMembroPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'ADMINISTRADOR') {
    return <AcessoNegado />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Novo Membro</h1>
      <NovoMembroForm />
    </div>
  )
}
