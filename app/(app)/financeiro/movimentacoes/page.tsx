import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { MovimentacoesTable } from '../MovimentacoesTable'
import { GerarReciboModal } from '../GerarReciboModal'
import { formatarMoedaBR } from '@/lib/format'

type SearchParams = {
  dataInicio?: string
  dataFim?: string
  tipo?: string
  categoriaId?: string
  contaId?: string
  formaPagamentoId?: string
  membroId?: string
}

export default async function MovimentacoesPage({
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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeEditar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const [categorias, contas, formasPagamento, membros] = await Promise.all([
    supabase.from('categorias_movimentacao').select('id, nome, tipo').order('tipo').order('nome'),
    supabase.from('contas').select('id, nome').order('nome'),
    supabase.from('formas_pagamento').select('id, nome').order('nome'),
    supabase.from('membros').select('id, nome').order('nome'),
  ])

  let query = supabase
    .from('movimentacoes')
    .select(
      'id, data, tipo, descricao, valor, origem, status, motivo_cancelamento, categorias_movimentacao(nome), contas(nome), formas_pagamento(nome), membros(nome)'
    )
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (params.dataInicio) query = query.gte('data', params.dataInicio)
  if (params.dataFim) query = query.lte('data', params.dataFim)
  if (params.tipo) query = query.eq('tipo', params.tipo)
  if (params.categoriaId) query = query.eq('categoria_id', params.categoriaId)
  if (params.contaId) query = query.eq('conta_id', params.contaId)
  if (params.formaPagamentoId) query = query.eq('forma_pagamento_id', params.formaPagamentoId)
  if (params.membroId) query = query.eq('membro_id', params.membroId)

  const { data: movimentacoes, error } = await query

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar movimentações: {error.message}
      </div>
    )
  }

  let anexosPorMovimentacao: Record<string, { id: string; nome_arquivo: string; tamanho_bytes: number; criado_em: string }[]> = {}
  if ((movimentacoes ?? []).length > 0) {
    const { data: anexosData } = await supabase
      .from('anexos')
      .select('id, nome_arquivo, tamanho_bytes, criado_em, entidade_id')
      .eq('entidade_tipo', 'MOVIMENTACAO')
      .eq('status', 'ATIVO')
      .in(
        'entidade_id',
        (movimentacoes ?? []).map((m) => m.id)
      )
      .order('criado_em', { ascending: false })

    anexosPorMovimentacao = {}
    for (const anexo of anexosData ?? []) {
      const lista = anexosPorMovimentacao[anexo.entidade_id] ?? []
      lista.push(anexo)
      anexosPorMovimentacao[anexo.entidade_id] = lista
    }
  }

  const ativas = (movimentacoes ?? []).filter((m) => m.status === 'ATIVO')
  const totalEntradas = ativas.filter((m) => m.tipo === 'ENTRADA').reduce((s, m) => s + Number(m.valor), 0)
  const totalSaidas = ativas.filter((m) => m.tipo === 'SAIDA').reduce((s, m) => s + Number(m.valor), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />

      <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">De</label>
          <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Até</label>
          <input type="date" name="dataFim" defaultValue={params.dataFim} className="w-full rounded border border-slate-300 px-2 py-1" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Tipo</label>
          <select name="tipo" defaultValue={params.tipo ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Categoria</label>
          <select name="categoriaId" defaultValue={params.categoriaId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(categorias.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.tipo === 'ENTRADA' ? 'E' : 'S'})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Conta</label>
          <select name="contaId" defaultValue={params.contaId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(contas.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Forma de pagamento</label>
          <select name="formaPagamentoId" defaultValue={params.formaPagamentoId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(formasPagamento.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-slate-500">Membro</label>
          <select name="membroId" defaultValue={params.membroId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todos</option>
            {(membros.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
          {podeEditar && <GerarReciboModal movimentacoes={movimentacoes ?? []} />}
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total entradas (ativas)</p>
          <p className="text-lg font-semibold text-green-700">{formatarMoedaBR(totalEntradas)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total saídas (ativas)</p>
          <p className="text-lg font-semibold text-red-700">{formatarMoedaBR(totalSaidas)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Saldo do período filtrado</p>
          <p className="text-lg font-semibold text-slate-900">{formatarMoedaBR(totalEntradas - totalSaidas)}</p>
        </div>
      </div>

      {(movimentacoes ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma movimentação encontrada.</p>
      ) : (
        <MovimentacoesTable
          movimentacoes={movimentacoes ?? []}
          podeEditar={podeEditar}
          anexosPorMovimentacao={anexosPorMovimentacao}
        />
      )}
    </div>
  )
}
