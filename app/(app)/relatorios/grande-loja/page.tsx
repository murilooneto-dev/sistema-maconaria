import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarRelatorioGrandeLoja, type FiltrosGrandeLoja } from '@/lib/relatorios/grande-loja'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { ResultadoRelatorioView } from '../ResultadoRelatorioView'

export default async function RelatorioGrandeLojaPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosGrandeLoja>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const resultado = await buscarRelatorioGrandeLoja(supabase, params)
  const queryString = paramsParaQueryString(params)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Relatório: Grande Loja</h1>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Ano do envio</label>
          <input type="number" name="ano" defaultValue={params.ano} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Mês do envio</label>
          <input type="number" name="mes" min={1} max={12} defaultValue={params.mes} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Situação</label>
          <select name="status" defaultValue={params.status ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ENVIADO">Enviado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <ResultadoRelatorioView resultado={resultado} slug="grande-loja" queryString={queryString} />
    </div>
  )
}
