import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { NovaContaForm } from './NovaContaForm'
import { ContasTable, type ContaPagarReceber } from './ContasTable'
import { buscarTodos } from '@/lib/supabase/buscar-todos'
import { contaVencida } from '@/lib/domain/contas-pagar-receber'
import { hojeISO } from '@/lib/datas'
import { formatarMoedaBR } from '@/lib/format'

type SearchParams = { tipo?: string; situacao?: string }

const SITUACOES = [
  { valor: 'ABERTA', rotulo: 'Em aberto' },
  { valor: 'VENCIDA', rotulo: 'Vencidas' },
  { valor: 'BAIXADA', rotulo: 'Pagas/recebidas' },
  { valor: 'CANCELADA', rotulo: 'Canceladas' },
  { valor: 'TODAS', rotulo: 'Todas' },
]

export default async function ContasAPagarPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeEditar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const hoje = hojeISO()
  const situacao = SITUACOES.some((s) => s.valor === params.situacao) ? params.situacao! : 'ABERTA'
  const tipo = params.tipo === 'PAGAR' || params.tipo === 'RECEBER' ? params.tipo : ''

  const colunas =
    'id, tipo, nome, valor, data_vencimento, observacao, recorrencia_id, parcela, total_parcelas, status, data_baixa, valor_baixa, motivo_cancelamento'

  const [listaRes, abertasRes, nomesRes, contas, formasPagamento, categorias] = await Promise.all([
    buscarTodos<ContaPagarReceber>((de, ate) => {
      let query = supabase.from('contas_pagar_receber').select(colunas)
      if (tipo) query = query.eq('tipo', tipo)
      if (situacao === 'VENCIDA') query = query.eq('status', 'ABERTA').lt('data_vencimento', hoje)
      else if (situacao !== 'TODAS') query = query.eq('status', situacao)
      return query.order('data_vencimento').order('id').range(de, ate)
    }),
    // Totais do topo: sempre sobre tudo que está em aberto, independente do filtro da lista.
    buscarTodos((de, ate) =>
      supabase
        .from('contas_pagar_receber')
        .select('tipo, valor, status, data_vencimento')
        .eq('status', 'ABERTA')
        .order('id')
        .range(de, ate)
    ),
    buscarTodos((de, ate) => supabase.from('contas_pagar_receber').select('nome').order('id').range(de, ate)),
    supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
    supabase
      .from('categorias_movimentacao')
      .select('id, nome, tipo')
      .eq('sistema', false)
      .eq('ativo', true)
      .order('nome'),
  ])

  if (listaRes.error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar contas a pagar e a receber: {listaRes.error.message}
      </div>
    )
  }

  const abertas = abertasRes.data ?? []
  const somar = (lista: { valor: number }[]) => lista.reduce((s, c) => s + Number(c.valor), 0)
  const totalAPagar = somar(abertas.filter((c) => c.tipo === 'PAGAR'))
  const totalAReceber = somar(abertas.filter((c) => c.tipo === 'RECEBER'))
  const vencidas = abertas.filter((c) => contaVencida(c, hoje))

  const nomesJaUsados = [...new Set((nomesRes.data ?? []).map((c) => c.nome))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />

      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">A pagar (em aberto)</dt>
          <dd className="text-lg font-semibold text-red-700">{formatarMoedaBR(totalAPagar)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">A receber (em aberto)</dt>
          <dd className="text-lg font-semibold text-green-700">{formatarMoedaBR(totalAReceber)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Vencidas</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {vencidas.length} <span className="text-sm font-normal text-slate-500">({formatarMoedaBR(somar(vencidas))})</span>
          </dd>
        </div>
      </dl>

      {podeEditar && <NovaContaForm nomesJaUsados={nomesJaUsados} />}

      <form className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="filtro-tipo" className="block text-xs font-medium text-slate-500">
            Tipo
          </label>
          <select id="filtro-tipo" name="tipo" defaultValue={tipo} className="rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            <option value="PAGAR">A pagar</option>
            <option value="RECEBER">A receber</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="filtro-situacao" className="block text-xs font-medium text-slate-500">
            Situação
          </label>
          <select
            id="filtro-situacao"
            name="situacao"
            defaultValue={situacao}
            className="rounded border border-slate-300 px-2 py-1"
          >
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Filtrar
        </button>
      </form>

      <ContasTable
        contasPagarReceber={listaRes.data ?? []}
        hoje={hoje}
        podeEditar={podeEditar}
        contas={contas.data ?? []}
        formasPagamento={formasPagamento.data ?? []}
        categorias={categorias.data ?? []}
      />
    </div>
  )
}
