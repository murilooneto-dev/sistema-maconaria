import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarBalancete, type FiltrosBalancete } from '@/lib/relatorios/balancete'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { formatarMoedaBR } from '@/lib/format'
import { BalanceteTable } from './BalanceteTable'

export default async function RelatorioBalancetePage({
  searchParams,
}: {
  searchParams: Promise<FiltrosBalancete>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const balancete = await buscarBalancete(supabase, params)
  const queryString = paramsParaQueryString(params)
  const sufixo = queryString ? `?${queryString}` : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Balancete financeiro (analítico)</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/relatorios/balancete/pdf${sufixo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            PDF
          </a>
          <a href={`/relatorios/balancete/csv${sufixo}`} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
            Excel (CSV)
          </a>
        </div>
      </div>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Entradas</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(balancete.totalEntradas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saídas</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(balancete.totalSaidas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saldo do período</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(balancete.saldoPeriodo)}</dd>
        </div>
      </dl>

      <BalanceteTable balancete={balancete} />
    </div>
  )
}
