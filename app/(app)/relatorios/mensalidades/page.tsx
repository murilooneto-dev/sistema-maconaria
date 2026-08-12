import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarRelatorioMensalidades, type FiltrosMensalidades } from '@/lib/relatorios/mensalidades'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { ResultadoRelatorioView } from '../ResultadoRelatorioView'

export default async function RelatorioMensalidadesPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosMensalidades>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const resultado = await buscarRelatorioMensalidades(supabase, params)
  const queryString = paramsParaQueryString(params)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Relatório: Mensalidades / Inadimplência</h1>

      <form className="flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Situação</label>
          <select name="situacao" defaultValue={params.situacao ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      <ResultadoRelatorioView resultado={resultado} slug="mensalidades" queryString={queryString} />
    </div>
  )
}
