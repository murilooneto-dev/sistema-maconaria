import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { ConfigMensalidadeForm } from '@/components/configuracoes/ConfigMensalidadeForm'

export default async function RemidosConfigPage() {
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

  const { data: historico, error } = await supabase
    .from('config_mensalidade')
    .select('id, valor_mensalidade, valor_grande_loja, vigente_desde')
    .eq('tipo', 'REMIDO')
    .order('vigente_desde', { ascending: false })

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Remidos</h1>
      <ConfigMensalidadeForm tipo="REMIDO" atual={historico[0] ?? null} historico={historico.slice(1)} />
    </div>
  )
}
