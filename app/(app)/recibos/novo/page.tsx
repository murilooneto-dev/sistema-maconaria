import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { GerarReciboForm } from './GerarReciboForm'

export default async function NovoReciboPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; membroId?: string; campanhaId?: string }>
}) {
  const params = await searchParams
  const tipo =
    params.tipo === 'CAMPANHA' ? 'CAMPANHA' : params.tipo === 'MOVIMENTACAO' ? 'MOVIMENTACAO' : 'MENSALIDADE'

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'TESOUREIRO') {
    return <AcessoNegado />
  }

  const { data: membros } = await supabase.from('membros').select('id, nome').order('nome')
  const { data: campanhas } = await supabase.from('campanhas').select('id, titulo').order('titulo')

  let pagamentos: { id: string; valor_total: number; data_pagamento: string }[] = []
  if (tipo === 'MENSALIDADE' && params.membroId) {
    const { data } = await supabase
      .from('pagamentos')
      .select('id, valor_total, data_pagamento')
      .eq('membro_id', params.membroId)
      .eq('status', 'ATIVO')
      .order('data_pagamento', { ascending: false })
    pagamentos = data ?? []
  }

  let doacoes: { id: string; doador: string; valor: number; data: string }[] = []
  if (tipo === 'CAMPANHA' && params.campanhaId) {
    const { data } = await supabase
      .from('doacoes')
      .select('id, doador, valor, data')
      .eq('campanha_id', params.campanhaId)
      .eq('status', 'ATIVO')
      .order('data', { ascending: false })
    doacoes = data ?? []
  }

  let movimentacoes: {
    id: string
    data: string
    valor: number
    descricao: string | null
    membroId: string | null
    membroNome: string | null
    categoriaNome: string | null
  }[] = []
  if (tipo === 'MOVIMENTACAO') {
    const { data } = await supabase
      .from('movimentacoes')
      .select('id, data, valor, descricao, membro_id, membros(nome), categorias_movimentacao(nome)')
      .eq('tipo', 'ENTRADA')
      .eq('status', 'ATIVO')
      .eq('origem', 'MANUAL')
      .order('data', { ascending: false })

    movimentacoes = (data ?? []).map((m) => {
      const membro = Array.isArray(m.membros) ? m.membros[0] : m.membros
      const categoria = Array.isArray(m.categorias_movimentacao) ? m.categorias_movimentacao[0] : m.categorias_movimentacao
      return {
        id: m.id,
        data: m.data,
        valor: Number(m.valor),
        descricao: m.descricao,
        membroId: m.membro_id,
        membroNome: membro?.nome ?? null,
        categoriaNome: categoria?.nome ?? null,
      }
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Gerar recibo</h1>

      <div className="flex gap-2 border-b border-slate-200 text-sm">
        <a
          href="/recibos/novo?tipo=MENSALIDADE"
          className={
            tipo === 'MENSALIDADE'
              ? 'border-b-2 border-slate-900 px-3 py-2 font-medium text-slate-900'
              : 'border-b-2 border-transparent px-3 py-2 text-slate-500 hover:text-slate-900'
          }
        >
          Mensalidade
        </a>
        <a
          href="/recibos/novo?tipo=CAMPANHA"
          className={
            tipo === 'CAMPANHA'
              ? 'border-b-2 border-slate-900 px-3 py-2 font-medium text-slate-900'
              : 'border-b-2 border-transparent px-3 py-2 text-slate-500 hover:text-slate-900'
          }
        >
          Campanha
        </a>
        <a
          href="/recibos/novo?tipo=MOVIMENTACAO"
          className={
            tipo === 'MOVIMENTACAO'
              ? 'border-b-2 border-slate-900 px-3 py-2 font-medium text-slate-900'
              : 'border-b-2 border-transparent px-3 py-2 text-slate-500 hover:text-slate-900'
          }
        >
          Movimentação
        </a>
      </div>

      {tipo === 'MENSALIDADE' && (
        <form className="max-w-md space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="tipo" value="MENSALIDADE" />
          <label className="text-sm font-medium text-slate-700">Membro</label>
          <select
            name="membroId"
            defaultValue={params.membroId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {(membros ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            Buscar
          </button>
        </form>
      )}

      {tipo === 'CAMPANHA' && (
        <form className="max-w-md space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="tipo" value="CAMPANHA" />
          <label className="text-sm font-medium text-slate-700">Campanha</label>
          <select
            name="campanhaId"
            defaultValue={params.campanhaId}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {(campanhas ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
            Buscar
          </button>
        </form>
      )}

      {tipo === 'MENSALIDADE' && params.membroId && (
        <GerarReciboForm tipo="MENSALIDADE" pagamentos={pagamentos} doacoes={[]} movimentacoes={[]} />
      )}
      {tipo === 'CAMPANHA' && params.campanhaId && (
        <GerarReciboForm tipo="CAMPANHA" pagamentos={[]} doacoes={doacoes} movimentacoes={[]} />
      )}
      {tipo === 'MOVIMENTACAO' && (
        <GerarReciboForm tipo="MOVIMENTACAO" pagamentos={[]} doacoes={[]} movimentacoes={movimentacoes} />
      )}
    </div>
  )
}
