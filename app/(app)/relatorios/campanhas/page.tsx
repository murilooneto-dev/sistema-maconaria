import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarRelatorioCampanhas } from '@/lib/relatorios/campanhas'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { ResultadoRelatorioView } from '../ResultadoRelatorioView'

export default async function RelatorioCampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; campanhaId?: string; modo?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: campanhas } = await supabase.from('campanhas').select('id, titulo').order('titulo')

  const modoEspecifica = params.modo === 'especifica' || Boolean(params.campanhaId)

  const resultado = await buscarRelatorioCampanhas(supabase, {
    status: params.status,
    campanhaId: params.campanhaId,
  })
  const queryString = paramsParaQueryString({ status: params.status, campanhaId: params.campanhaId })

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">
        Relatório: {modoEspecifica ? 'Campanha específica' : 'Resumo geral de campanhas'}
      </h1>

      {modoEspecifica ? (
        <form className="max-w-sm space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <label className="text-xs font-medium text-slate-500">Campanha</label>
          <select name="campanhaId" defaultValue={params.campanhaId} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Selecione...</option>
            {(campanhas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Ver relatório
          </button>
        </form>
      ) : (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Status</label>
            <select name="status" defaultValue={params.status ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
              <option value="">Todos</option>
              <option value="EM_ANDAMENTO">Em andamento</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </form>
      )}

      {(!modoEspecifica || params.campanhaId) && (
        <ResultadoRelatorioView resultado={resultado} slug="campanhas" queryString={queryString} />
      )}
    </div>
  )
}
