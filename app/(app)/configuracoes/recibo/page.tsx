import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { AssinaturaForm } from './AssinaturaForm'

export default async function ReciboConfigPage() {
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

  const { data: lojaConfig, error } = await supabase
    .from('loja_config')
    .select('assinatura_url')
    .eq('id', 1)
    .single()

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração de recibo: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Recibo</h1>
      <AssinaturaForm assinaturaUrl={lojaConfig?.assinatura_url ?? null} />
    </div>
  )
}
