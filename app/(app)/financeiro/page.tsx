import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from './FinanceiroTabs'
import { CentrosDeCustoGrid } from './CentrosDeCustoGrid'
import { buscarDadosCentrosDeCusto } from '@/lib/relatorios/centros-de-custo'

import { hojeISO, primeiroDiaMesAtual } from '@/lib/datas'

type SearchParams = { dataInicio?: string; dataFim?: string }

export default async function FinanceiroVisaoGeralPage({
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

  const dataInicio = params.dataInicio || primeiroDiaMesAtual()
  const dataFim = params.dataFim || hojeISO()

  const centros = await buscarDadosCentrosDeCusto(supabase, { dataInicio, dataFim })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      </div>
      <FinanceiroTabs />

      <form className="flex flex-wrap items-end gap-2 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={dataInicio} className="rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={dataFim} className="rounded border border-slate-300 px-2 py-1" />
        </div>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      {centros.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum centro de custo cadastrado.{' '}
          <Link href="/configuracoes/centros-de-custo" className="underline">
            Cadastre um em Configurações
          </Link>
          .
        </p>
      ) : (
        <CentrosDeCustoGrid centros={centros} />
      )}
    </div>
  )
}
