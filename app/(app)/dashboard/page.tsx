import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarDadosDashboard } from '@/lib/dashboard/dados'
import { formatarDataBR, formatarMoedaBR } from '@/lib/format'
import { GraficoEntradasSaidas } from './GraficoEntradasSaidas'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ dataInicio?: string; dataFim?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const dados = await buscarDadosDashboard(supabase, params)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">De</label>
            <input
              type="date"
              name="dataInicio"
              defaultValue={dados.periodo.dataInicio}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">Até</label>
            <input
              type="date"
              name="dataFim"
              defaultValue={dados.periodo.dataFim}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </div>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </form>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Total de membros</dt>
          <dd className="text-lg font-semibold text-slate-900">{dados.totalMembros}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Ativos</dt>
          <dd className="text-lg font-semibold text-green-700">{dados.ativos}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Inativos</dt>
          <dd className="text-lg font-semibold text-slate-400">{dados.inativos}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Inadimplentes</dt>
          <dd className="text-lg font-semibold text-red-700">{dados.inadimplentes}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Entradas do período</dt>
          <dd className="text-lg font-semibold text-green-700">{formatarMoedaBR(dados.entradasPeriodo)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saídas do período</dt>
          <dd className="text-lg font-semibold text-red-700">{formatarMoedaBR(dados.saidasPeriodo)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
          <dt className="text-xs text-slate-500">Saldo consolidado</dt>
          <dd className="text-lg font-semibold text-slate-900">{formatarMoedaBR(dados.saldoConsolidado)}</dd>
        </div>
      </dl>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Entradas x Saídas (últimos 6 meses)</h2>
          <GraficoEntradasSaidas dados={dados.graficoMensal} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Saldos por conta</h2>
          {dados.saldosPorConta.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma conta cadastrada.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dados.saldosPorConta.map((c) => (
                <li key={c.nome} className="flex items-center justify-between">
                  <span className="text-slate-700">{c.nome}</span>
                  <span className="font-medium text-slate-900">{formatarMoedaBR(c.saldo)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Campanhas em andamento</h2>
            <Link href="/campanhas" className="text-xs text-slate-500 underline">
              Ver todas
            </Link>
          </div>
          {dados.campanhasEmAndamento.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma campanha em andamento.</p>
          ) : (
            <ul className="space-y-3">
              {dados.campanhasEmAndamento.map((c) => (
                <li key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <Link href={`/campanhas/${c.id}`} className="font-medium text-slate-900 underline">
                      {c.titulo}
                    </Link>
                    <span className="text-slate-500">{c.percentual.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${c.percentual}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatarMoedaBR(c.arrecadado)} de {formatarMoedaBR(c.meta)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Últimas movimentações</h2>
            <Link href="/financeiro/movimentacoes" className="text-xs text-slate-500 underline">
              Ver todas
            </Link>
          </div>
          {dados.ultimasMovimentacoes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {dados.ultimasMovimentacoes.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-slate-900">{m.categoria}</p>
                    <p className="text-xs text-slate-500">{formatarDataBR(m.data)}</p>
                  </div>
                  <span className={m.tipo === 'ENTRADA' ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
                    {m.tipo === 'ENTRADA' ? '+' : '-'}
                    {formatarMoedaBR(m.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
