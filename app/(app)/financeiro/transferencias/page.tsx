import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { NovaTransferenciaForm } from './NovaTransferenciaForm'
import { TransferenciasTable } from './TransferenciasTable'

export default async function TransferenciasPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeEditar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const { data: contas } = await supabase.from('contas').select('id, nome').eq('ativo', true).order('nome')

  const { data: transferencias, error } = await supabase
    .from('transferencias')
    .select(
      'id, data, valor, observacao, status, motivo_cancelamento, conta_origem:contas!transferencias_conta_origem_id_fkey(nome), conta_destino:contas!transferencias_conta_destino_id_fkey(nome)'
    )
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar transferências: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />
      <NovaTransferenciaForm contas={contas ?? []} />
      {(transferencias ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma transferência registrada.</p>
      ) : (
        <TransferenciasTable transferencias={transferencias ?? []} podeEditar={podeEditar} />
      )}
    </div>
  )
}
