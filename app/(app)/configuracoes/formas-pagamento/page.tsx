import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { NovaFormaPagamentoForm } from './NovaFormaPagamentoForm'
import { FormasPagamentoTable } from './FormasPagamentoTable'

export default async function FormasPagamentoConfigPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'ADMINISTRADOR') {
    return <AcessoNegado />
  }

  const { data: formas, error } = await supabase
    .from('formas_pagamento')
    .select('id, nome, ativo')
    .order('nome')

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Erro ao carregar formas de pagamento: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Configurações — Formas de pagamento</h1>
      <NovaFormaPagamentoForm />
      {formas.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma forma de pagamento cadastrada.</p>
      ) : (
        <FormasPagamentoTable formas={formas} />
      )}
    </div>
  )
}
