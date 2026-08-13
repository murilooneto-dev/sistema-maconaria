import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarRelatorioMembros } from '@/lib/relatorios/membros'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { ResultadoRelatorioView } from '../ResultadoRelatorioView'

export default async function RelatorioMembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ situacao?: string; doQuadro?: string; remido?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const resultado = await buscarRelatorioMembros(supabase, params)
  const queryString = paramsParaQueryString(params)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Relatório: Resumo de membros</h1>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Situação</label>
          <select name="situacao" defaultValue={params.situacao ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="IRREGULAR">Irregular</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Do quadro</label>
          <select name="doQuadro" defaultValue={params.doQuadro ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Remido</label>
          <select name="remido" defaultValue={params.remido ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <ResultadoRelatorioView resultado={resultado} slug="membros" queryString={queryString} />
    </div>
  )
}
