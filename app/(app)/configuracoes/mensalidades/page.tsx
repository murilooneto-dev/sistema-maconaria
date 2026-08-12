import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { ConfigMensalidadeForm } from '@/components/configuracoes/ConfigMensalidadeForm'

export default async function MensalidadesConfigPage() {
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

  const { data: historicoCompleto, error } = await supabase
    .from('config_mensalidade')
    .select('id, tipo, valor_mensalidade, valor_grande_loja, vigente_desde')
    .order('vigente_desde', { ascending: false })

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração: {error.message}
      </div>
    )
  }

  const historicoNormal = historicoCompleto.filter((item) => item.tipo === 'NORMAL')
  const historicoRemido = historicoCompleto.filter((item) => item.tipo === 'REMIDO')

  return (
    <div className="space-y-10">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Mensalidades</h1>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Normal</h2>
        <ConfigMensalidadeForm
          tipo="NORMAL"
          atual={historicoNormal[0] ?? null}
          historico={historicoNormal.slice(1)}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Remidos</h2>
        <ConfigMensalidadeForm
          tipo="REMIDO"
          atual={historicoRemido[0] ?? null}
          historico={historicoRemido.slice(1)}
        />
      </section>
    </div>
  )
}
