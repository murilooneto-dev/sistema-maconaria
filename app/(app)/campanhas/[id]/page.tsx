import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AcessoNegado } from '@/components/AcessoNegado'
import { calcularArrecadado, calcularPercentual } from '@/lib/domain/campanhas'
import { NovaDoacaoForm } from './NovaDoacaoForm'
import { DoacoesTable } from './DoacoesTable'
import { StatusCampanhaActions } from './StatusCampanhaActions'
import { EditarCampanhaForm } from './EditarCampanhaForm'

const STATUS_LABEL: Record<string, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

export default async function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <AcessoNegado />
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const podeEditar = profile?.role === 'ADMINISTRADOR' || profile?.role === 'TESOUREIRO'

  const { data: campanha, error } = await supabase.from('campanhas').select('*').eq('id', id).single()

  if (error || !campanha) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Campanha não encontrada.
      </div>
    )
  }

  const { data: doacoes } = await supabase
    .from('doacoes')
    .select('id, doador, membro_id, valor, data, observacao, status, motivo_cancelamento, membros(nome)')
    .eq('campanha_id', id)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  const doacoesAtivas = (doacoes ?? []).filter((d) => d.status === 'ATIVO')
  const arrecadado = calcularArrecadado(doacoesAtivas)
  const meta = Number(campanha.meta)
  const percentual = calcularPercentual(arrecadado, meta)
  const saldo = Math.max(0, meta - arrecadado)

  const [contas, formasPagamento, membros] = await Promise.all([
    supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('formas_pagamento').select('id, nome').eq('ativo', true).order('nome'),
    supabase.from('membros').select('id, nome').order('nome'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{campanha.titulo}</h1>
          <p className="text-sm text-slate-500">{STATUS_LABEL[campanha.status]}</p>
        </div>
        {podeEditar && (
          <div className="flex gap-2">
            <EditarCampanhaForm campanha={campanha} />
            <StatusCampanhaActions campanhaId={campanha.id} status={campanha.status} />
          </div>
        )}
      </div>

      {campanha.objetivo && <p className="text-sm text-slate-700">{campanha.objetivo}</p>}
      {campanha.descricao && <p className="text-sm text-slate-500">{campanha.descricao}</p>}

      <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Meta</dt>
          <dd className="text-lg font-semibold text-slate-900">R$ {meta.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Arrecadado</dt>
          <dd className="text-lg font-semibold text-green-700">R$ {arrecadado.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Saldo</dt>
          <dd className="text-lg font-semibold text-slate-900">R$ {saldo.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Percentual</dt>
          <dd className="text-lg font-semibold text-slate-900">{percentual.toFixed(0)}%</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">Pessoa ajudada</dt>
          <dd className="text-sm font-medium text-slate-900">{campanha.pessoa_ajudada ?? '-'}</dd>
        </div>
      </dl>

      {podeEditar && campanha.status === 'EM_ANDAMENTO' && (
        <NovaDoacaoForm
          campanhaId={campanha.id}
          contas={contas.data ?? []}
          formasPagamento={formasPagamento.data ?? []}
          membros={membros.data ?? []}
        />
      )}

      {(doacoes ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma doação registrada ainda.</p>
      ) : (
        <DoacoesTable doacoes={doacoes ?? []} podeEditar={podeEditar} />
      )}
    </div>
  )
}
