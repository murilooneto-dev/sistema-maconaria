import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarDadosCentrosDeCusto, SEM_CENTRO_ID } from '@/lib/relatorios/centros-de-custo'
import { filtrarCentroDeCusto, detalharCentrosDeCusto } from '@/lib/relatorios/centros-de-custo-relatorio'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { formatarMoedaBR } from '@/lib/format'
import { CentrosDeCustoRelatorioTable } from './CentrosDeCustoRelatorioTable'

type SearchParams = { dataInicio?: string; dataFim?: string; centroDeCustoId?: string }

export default async function RelatorioCentrosDeCustoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: centrosAtivos } = await supabase
    .from('centros_de_custo')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  const dados = await buscarDadosCentrosDeCusto(supabase, {
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  })
  const filtrados = filtrarCentroDeCusto(dados, params.centroDeCustoId)
  const detalhados = detalharCentrosDeCusto(filtrados)

  const totalEntradas = detalhados.reduce((s, c) => s + c.totalEntradas, 0)
  const totalSaidas = detalhados.reduce((s, c) => s + c.totalSaidas, 0)

  const queryString = paramsParaQueryString(params)
  const sufixo = queryString ? `?${queryString}` : ''

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Relatório por centro de custo</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/relatorios/centros-de-custo/pdf${sufixo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            PDF
          </a>
          <a
            href={`/relatorios/centros-de-custo/csv${sufixo}`}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Excel (CSV)
          </a>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Uma categoria pode pertencer a mais de um centro de custo. Quando isso ocorre, a movimentação aparece em
        todos os centros vinculados, e a soma dos centros pode ultrapassar o total geral do período.
      </p>

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Centro de custo</label>
          <select
            name="centroDeCustoId"
            defaultValue={params.centroDeCustoId ?? ''}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="">Todos</option>
            {(centrosAtivos ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value={SEM_CENTRO_ID}>Sem centro de custo</option>
          </select>
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
          <dd className="text-lg font-semibold text-green-700">{formatarMoedaBR(totalEntradas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saídas</dt>
          <dd className="text-lg font-semibold text-red-700">{formatarMoedaBR(totalSaidas)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saldo do período</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(totalEntradas - totalSaidas)}</dd>
        </div>
      </dl>

      <CentrosDeCustoRelatorioTable centros={detalhados} />
    </div>
  )
}
