import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { buscarRelatorioFinanceiro, type FiltrosFinanceiro } from '@/lib/relatorios/financeiro'
import { paramsParaQueryString } from '@/lib/relatorios/query'
import { ResultadoRelatorioView } from '../ResultadoRelatorioView'

export default async function RelatorioFinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosFinanceiro>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const [categorias, contas, formasPagamento, membros, campanhas] = await Promise.all([
    supabase.from('categorias_movimentacao').select('id, nome, tipo').order('nome'),
    supabase.from('contas').select('id, nome').order('nome'),
    supabase.from('formas_pagamento').select('id, nome').order('nome'),
    supabase.from('membros').select('id, nome').order('nome'),
    supabase.from('campanhas').select('id, titulo').order('titulo'),
  ])

  const resultado = await buscarRelatorioFinanceiro(supabase, params)
  const queryString = paramsParaQueryString(params)

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Relatório: Movimentação de entradas e saídas</h1>

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
                {c.nome}
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
        <div className="space-y-1">
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Campanha</label>
          <select name="campanhaId" defaultValue={params.campanhaId ?? ''} className="w-full rounded border border-slate-300 px-2 py-1">
            <option value="">Todas</option>
            {(campanhas.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Filtrar
          </button>
        </div>
      </form>

      <ResultadoRelatorioView resultado={resultado} slug="financeiro" queryString={queryString} />
    </div>
  )
}
