import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { FinanceiroTabs } from '../../FinanceiroTabs'
import { NovaMovimentacaoForm } from '../../nova/NovaMovimentacaoForm'

export default async function EditarMovimentacaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: movimentacao } = await supabase
    .from('movimentacoes')
    .select(
      'id, data, tipo, categoria_id, descricao, valor, conta_id, forma_pagamento_id, membro_id, observacao, status, origem'
    )
    .eq('id', id)
    .single()

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

      {!movimentacao || movimentacao.status !== 'ATIVO' || movimentacao.origem === 'MENSALIDADE' ? (
        <p className="text-sm text-red-600">
          Esta movimentação não pode ser editada (não encontrada, já cancelada, ou gerada automaticamente por um
          pagamento de mensalidade).
        </p>
      ) : (
        <NovaMovimentacaoForm
          categorias={categorias.data ?? []}
          contas={contas.data ?? []}
          formasPagamento={formasPagamento.data ?? []}
          membros={membros.data ?? []}
          modoEdicao={{
            movimentacaoId: movimentacao.id,
            valoresIniciais: {
              data: movimentacao.data,
              tipo: movimentacao.tipo,
              categoriaId: movimentacao.categoria_id,
              descricao: movimentacao.descricao ?? '',
              valor: Number(movimentacao.valor),
              contaId: movimentacao.conta_id,
              formaPagamentoId: movimentacao.forma_pagamento_id,
              membroId: movimentacao.membro_id ?? '',
              observacao: movimentacao.observacao ?? '',
            },
          }}
        />
      )}
    </div>
  )
}
