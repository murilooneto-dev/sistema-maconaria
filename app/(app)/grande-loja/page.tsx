import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { calcularTotal } from '@/lib/domain/grande-loja'
import { ItensPendentesForm } from './ItensPendentesForm'
import { HistoricoRepasses } from './HistoricoRepasses'

export default async function GrandeLojaPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>
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

  const { data: itensPendentes, error } = await supabase
    .from('repasses_grande_loja_itens')
    .select('id, valor, mensalidades(ano, mes, membro_id, membros(nome))')
    .eq('status', 'PENDENTE')
    .is('repasse_id', null)
    .order('created_at')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar itens pendentes: {error.message}
      </div>
    )
  }

  const totalPendente = calcularTotal(itensPendentes ?? [])
  const membrosDistintos = new Set(
    (itensPendentes ?? []).map((i) => {
      const m = Array.isArray(i.mensalidades) ? i.mensalidades[0] : i.mensalidades
      const membro = m && (Array.isArray(m.membros) ? m.membros[0] : m.membros)
      return membro?.nome
    })
  )

  const [contas, formasPagamento] = await Promise.all([
    supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
  ])

  let query = supabase
    .from('repasses_grande_loja')
    .select('id, data_envio, valor_total, observacao, status, usuario_id, contas(nome), profiles(nome)')
    .order('data_envio', { ascending: false })

  if (params.ano && params.mes) {
    const inicio = `${params.ano}-${params.mes.padStart(2, '0')}-01`
    const [anoNum, mesNum] = [Number(params.ano), Number(params.mes)]
    const fim = mesNum === 12 ? `${anoNum + 1}-01-01` : `${anoNum}-${String(mesNum + 1).padStart(2, '0')}-01`
    query = query.gte('data_envio', inicio).lt('data_envio', fim)
  }

  const { data: repasses } = await query

  const totalEnviado = (repasses ?? [])
    .filter((r) => r.status === 'ENVIADO')
    .reduce((s, r) => s + Number(r.valor_total), 0)

  type ItemRepasse = {
    id: string
    valor: number
    repasse_id: string | null
    mensalidades: { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null }[] | { ano: number; mes: number; membros: { nome: string }[] | { nome: string } | null } | null
  }

  const repasseIds = (repasses ?? []).map((r) => r.id)
  const { data: itensDosRepasses } = await supabase
    .from('repasses_grande_loja_itens')
    .select('id, valor, repasse_id, mensalidades(ano, mes, membros(nome))')
    .in('repasse_id', repasseIds.length > 0 ? repasseIds : ['00000000-0000-0000-0000-000000000000'])

  const itensPorRepasse = new Map<string, ItemRepasse[]>()
  for (const item of (itensDosRepasses ?? []) as ItemRepasse[]) {
    if (!item.repasse_id) continue
    const lista = itensPorRepasse.get(item.repasse_id) ?? []
    lista.push(item)
    itensPorRepasse.set(item.repasse_id, lista)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Grande Loja</h1>

      <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Membros pendentes</dt>
          <dd className="text-lg font-semibold text-slate-900">{membrosDistintos.size}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Itens pendentes</dt>
          <dd className="text-lg font-semibold text-slate-900">{(itensPendentes ?? []).length}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Total a enviar</dt>
          <dd className="text-lg font-semibold text-amber-700">R$ {totalPendente.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Enviados (filtro atual)</dt>
          <dd className="text-lg font-semibold text-green-700">R$ {totalEnviado.toFixed(2)}</dd>
        </div>
      </dl>

      {podeEditar && (itensPendentes ?? []).length > 0 && (
        <ItensPendentesForm
          itens={itensPendentes ?? []}
          contas={contas.data ?? []}
          formasPagamento={formasPagamento.data ?? []}
        />
      )}

      <HistoricoRepasses
        repasses={repasses ?? []}
        itensPorRepasse={Object.fromEntries(itensPorRepasse)}
        podeEditar={podeEditar}
        filtro={params}
      />
    </div>
  )
}
