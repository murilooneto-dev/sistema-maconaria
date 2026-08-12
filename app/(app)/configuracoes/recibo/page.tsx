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
    .select('assinatura_url, assinatura_tesoureiro_url')
    .eq('id', 1)
    .single()

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar configuração de recibo: {error.message}
      </div>
    )
  }

  async function assinarUrl(path: string | null) {
    if (!path) return null
    const { data } = await supabase.storage.from('loja-assinaturas').createSignedUrl(path, 60 * 5)
    return data?.signedUrl ?? null
  }

  const [assinaturaVeneravelUrl, assinaturaTesoureiroUrl] = await Promise.all([
    assinarUrl(lojaConfig?.assinatura_url ?? null),
    assinarUrl(lojaConfig?.assinatura_tesoureiro_url ?? null),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Recibo</h1>
      <p className="text-sm text-slate-500">
        O recibo em PDF exibe as duas assinaturas lado a lado: Venerável Mestre à esquerda, Tesoureiro à direita.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <AssinaturaForm
          titulo="Assinatura do Venerável Mestre"
          cargo="Venerável Mestre"
          assinaturaUrl={assinaturaVeneravelUrl}
          tesoureiro={false}
        />
        <AssinaturaForm
          titulo="Assinatura do Tesoureiro"
          cargo="Tesoureiro"
          assinaturaUrl={assinaturaTesoureiroUrl}
          tesoureiro
        />
      </div>
    </div>
  )
}
