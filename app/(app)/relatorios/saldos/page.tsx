import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarRelatorioSaldos } from '@/lib/relatorios/saldos'
import { ResultadoRelatorioView } from '../ResultadoRelatorioView'

export default async function RelatorioSaldosPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const resultado = await buscarRelatorioSaldos(supabase)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Relatório: Saldos por conta</h1>
      <ResultadoRelatorioView resultado={resultado} slug="saldos" queryString="" />
    </div>
  )
}
