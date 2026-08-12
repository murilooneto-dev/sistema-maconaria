import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../FinanceiroTabs'
import { NovaMovimentacaoForm } from './NovaMovimentacaoForm'

export default async function NovaMovimentacaoPage() {
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

  const [categorias, contas, formasPagamento, membros] = await Promise.all([
    supabase
      .from('categorias_movimentacao')
      .select('id, nome, tipo')
      .eq('sistema', false)
      .eq('ativo', true)
      .order('tipo')
      .order('nome'),
    supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('membros').select('id, nome').order('nome'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Financeiro</h1>
      <FinanceiroTabs />
      <NovaMovimentacaoForm
        categorias={categorias.data ?? []}
        contas={contas.data ?? []}
        formasPagamento={formasPagamento.data ?? []}
        membros={membros.data ?? []}
      />
    </div>
  )
}
