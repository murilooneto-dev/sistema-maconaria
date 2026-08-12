import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { SelecionarMembro } from './SelecionarMembro'
import { PagamentoForm } from './PagamentoForm'
import { HistoricoPagamentos } from './HistoricoPagamentos'

export default async function PagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ membroId?: string }>
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
  if (profile?.role !== 'ADMINISTRADOR' && profile?.role !== 'TESOUREIRO') {
    return <AcessoNegado />
  }

  const { data: membros } = await supabase.from('membros').select('id, nome').eq('do_quadro', true).order('nome')
  const { data: contas } = await supabase.from('contas').select('id, nome').eq('ativo', true).order('nome')
  const { data: formasPagamento } = await supabase
    .from('formas_pagamento')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')

  let competencias: {
    id: string
    ano: number
    mes: number
    valor_devido: number
    valor_pago: number
    saldo: number
    status: string
  }[] = []
  let pagamentos: {
    id: string
    valor_total: number
    data_pagamento: string
    status: string
    motivo_cancelamento: string | null
  }[] = []

  if (params.membroId) {
    const { data: competenciasData } = await supabase
      .from('mensalidades')
      .select('id, ano, mes, valor_devido, valor_pago, saldo, status')
      .eq('membro_id', params.membroId)
      .in('status', ['PENDENTE', 'PARCIAL'])
      .order('ano')
      .order('mes')
    competencias = competenciasData ?? []

    const { data: pagamentosData } = await supabase
      .from('pagamentos')
      .select('id, valor_total, data_pagamento, status, motivo_cancelamento')
      .eq('membro_id', params.membroId)
      .order('data_pagamento', { ascending: false })
    pagamentos = pagamentosData ?? []
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Registrar pagamento</h1>
      <SelecionarMembro membros={membros ?? []} membroSelecionado={params.membroId} />
      {params.membroId && (
        <>
          <PagamentoForm
            membroId={params.membroId}
            competencias={competencias}
            contas={contas ?? []}
            formasPagamento={formasPagamento ?? []}
          />
          <HistoricoPagamentos pagamentos={pagamentos} />
        </>
      )}
    </div>
  )
}
